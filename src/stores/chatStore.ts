import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ContentType } from '@/api/enum'
import { randomID } from '@/utils/randomID'

export type ChatSessionType = 1 | 2
export type ChatMessageStatus = 'sending' | 'sent' | 'failed'
export type ChatMessageDirection = 'in' | 'out'

export interface ChatSessionMeta {
  id: string
  title: string
  avatar?: string
  type: ChatSessionType
  subTitle?: string
}

export interface ChatSessionInput {
  id: string
  title?: string
  avatar?: string
  type?: ChatSessionType
  subTitle?: string
}

export interface ChatUiMessage {
  localId: string
  sequence?: string
  fromId: string
  toId: string
  chatType: ChatSessionType
  contentType: number
  content: string
  timestamp: number
  direction: ChatMessageDirection
  status: ChatMessageStatus
}

export interface RecentChatItem {
  chatId: string
  title: string
  avatar?: string
  type: ChatSessionType
  subTitle?: string
  lastMessage: ChatUiMessage
  lastMessageText: string
  lastMessageTime: number
  unreadCount: number
  pinned: boolean
}

export interface ChatSessionConfigPayload {
  pinnedChatIds: string[]
  hiddenRecentChatIds: string[]
}

const buildMessageKey = (message: ChatUiMessage) =>
  message.sequence || `${message.fromId}|${message.toId}|${message.timestamp}|${message.content}`

interface SequencePointer {
  chatId: string
  localId: string
}

interface OutgoingMessageInput {
  localId?: string
  sequence?: string
  fromId: string
  toId: string
  chatType: ChatSessionType
  contentType?: number
  content: string
  timestamp?: number | string
}

interface IncomingMessageInput {
  localId?: string
  sequence?: string
  fromId: string
  toId: string
  chatType: ChatSessionType
  contentType?: number
  content: string
  timestamp?: number | string
}

const normalizeTimestamp = (timestamp?: number | string) => {
  if (typeof timestamp === 'number') {
    return Number.isFinite(timestamp) ? timestamp : Date.now()
  }

  if (typeof timestamp === 'string') {
    const raw = timestamp.trim()
    if (!raw) return Date.now()

    const numeric = Number(raw)
    if (Number.isFinite(numeric)) {
      return numeric
    }

    const parsed = new Date(raw).getTime()
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  return Date.now()
}

const createDefaultSessionMeta = (id: string): ChatSessionMeta => {
  const isGroup = id.startsWith('group_')
  return {
    id,
    title: id,
    avatar: '',
    type: isGroup ? 2 : 1,
    subTitle: isGroup ? '群聊' : '在线',
  }
}

const normalizeChatIdList = (rawList: string[] | undefined) => {
  if (!rawList || rawList.length === 0) return []

  const dedup = new Set<string>()
  rawList.forEach((id) => {
    const next = String(id || '').trim()
    if (!next) return
    dedup.add(next)
  })
  return Array.from(dedup)
}

export const useChatStore = defineStore('chat', () => {
  const activeChatId = ref<string | null>(null)
  const sessionMap = ref<Record<string, ChatSessionMeta>>({})
  const messagesByChatId = ref<Record<string, ChatUiMessage[]>>({})
  const unreadByChatId = ref<Record<string, number>>({})
  const sequenceIndex = ref<Record<string, SequencePointer>>({})
  const pinnedChatIds = ref<Record<string, boolean>>({})
  const hiddenRecentChatIds = ref<Record<string, boolean>>({})

  const activeSession = computed(() => {
    if (!activeChatId.value) return null
    return sessionMap.value[activeChatId.value] || null
  })

  const recentChats = computed<RecentChatItem[]>(() => {
    const items: RecentChatItem[] = []

    Object.entries(messagesByChatId.value).forEach(([chatId, messages]) => {
      if (!messages || messages.length === 0) return
      if (hiddenRecentChatIds.value[chatId]) return

      const lastMessage = messages[messages.length - 1]
      if (!lastMessage) return

      const fallback = createDefaultSessionMeta(chatId)
      const session = sessionMap.value[chatId] || fallback

      items.push({
        chatId,
        title: session.title,
        avatar: session.avatar,
        type: session.type,
        subTitle: session.subTitle,
        lastMessage,
        lastMessageText: lastMessage.content || '',
        lastMessageTime: lastMessage.timestamp || 0,
        unreadCount: unreadByChatId.value[chatId] || 0,
        pinned: !!pinnedChatIds.value[chatId],
      })
    })

    return items.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1
      }
      return b.lastMessageTime - a.lastMessageTime
    })
  })

  const ensureSession = (payload: string | ChatSessionInput) => {
    const isIdOnly = typeof payload === 'string'
    const id = isIdOnly ? payload : payload.id
    const existing = sessionMap.value[id]
    const fallback = createDefaultSessionMeta(id)

    const nextMeta: ChatSessionMeta = {
      id,
      title: isIdOnly
        ? existing?.title ?? fallback.title
        : payload.title ?? existing?.title ?? fallback.title,
      avatar: isIdOnly
        ? existing?.avatar ?? fallback.avatar
        : payload.avatar ?? existing?.avatar ?? fallback.avatar,
      type: isIdOnly
        ? existing?.type ?? fallback.type
        : payload.type ?? existing?.type ?? fallback.type,
      subTitle: isIdOnly
        ? existing?.subTitle ?? fallback.subTitle
        : payload.subTitle ?? existing?.subTitle ?? fallback.subTitle,
    }

    sessionMap.value[id] = nextMeta
    return nextMeta
  }
  const setActiveChat = (payload: string | ChatSessionInput | null) => {
    if (!payload) {
      activeChatId.value = null
      return
    }

    const meta = ensureSession(payload)
    restoreRecent(meta.id)
    activeChatId.value = meta.id
    clearUnread(meta.id)
  }

  const getMessages = (chatId: string | null) => {
    if (!chatId) return []
    return messagesByChatId.value[chatId] || []
  }

  const getActiveSessionMeta = () => activeSession.value

  const appendOutgoingMessage = (chatId: string, payload: OutgoingMessageInput) => {
    ensureSession(chatId)
    restoreRecent(chatId)
    const message: ChatUiMessage = {
      localId: payload.localId || randomID(),
      sequence: payload.sequence,
      fromId: payload.fromId,
      toId: payload.toId,
      chatType: payload.chatType,
      contentType: payload.contentType ?? ContentType.TEXT,
      content: payload.content,
      timestamp: normalizeTimestamp(payload.timestamp),
      direction: 'out',
      status: 'sending',
    }

    const list = messagesByChatId.value[chatId] || []
    list.push(message)
    messagesByChatId.value[chatId] = list

    if (message.sequence) {
      sequenceIndex.value[message.sequence] = { chatId, localId: message.localId }
    }

    return message
  }

  const appendIncomingMessage = (chatId: string, payload: IncomingMessageInput) => {
    ensureSession(chatId)
    restoreRecent(chatId)
    const message: ChatUiMessage = {
      localId: payload.localId || randomID(),
      sequence: payload.sequence,
      fromId: payload.fromId,
      toId: payload.toId,
      chatType: payload.chatType,
      contentType: payload.contentType ?? ContentType.TEXT,
      content: payload.content,
      timestamp: normalizeTimestamp(payload.timestamp),
      direction: 'in',
      status: 'sent',
    }

    const list = messagesByChatId.value[chatId] || []
    list.push(message)
    messagesByChatId.value[chatId] = list
    return message
  }

  const prependHistoryMessages = (chatId: string, incoming: ChatUiMessage[]) => {
    if (!incoming.length) return

    ensureSession(chatId)
    restoreRecent(chatId)

    const existing = messagesByChatId.value[chatId] || []
    const bucket = new Map<string, ChatUiMessage>()

    const merge = (message: ChatUiMessage) => {
      const key = buildMessageKey(message)
      const prev = bucket.get(key)
      if (!prev) {
        bucket.set(key, message)
        return
      }

      if (prev.status !== 'sent' && message.status === 'sent') {
        bucket.set(key, { ...prev, status: 'sent', sequence: prev.sequence || message.sequence })
      }
    }

    incoming.forEach(merge)
    existing.forEach(merge)

    const merged = Array.from(bucket.values()).sort((a, b) => a.timestamp - b.timestamp)
    messagesByChatId.value[chatId] = merged

    Object.keys(sequenceIndex.value).forEach((key) => {
      if (sequenceIndex.value[key]?.chatId === chatId) {
        delete sequenceIndex.value[key]
      }
    })

    merged.forEach((message) => {
      if (message.sequence && message.direction === 'out') {
        sequenceIndex.value[message.sequence] = { chatId, localId: message.localId }
      }
    })
  }

  const markMessageSentBySequence = (sequence: string) => {
    const pointer = sequenceIndex.value[sequence]
    if (!pointer) return false

    const list = messagesByChatId.value[pointer.chatId] || []
    const target = list.find((item) => item.localId === pointer.localId)
    if (!target) return false

    target.status = 'sent'
    return true
  }

  const markMessageFailedBySequence = (sequence: string) => {
    const pointer = sequenceIndex.value[sequence]
    if (!pointer) return false

    const list = messagesByChatId.value[pointer.chatId] || []
    const target = list.find((item) => item.localId === pointer.localId)
    if (!target) return false

    target.status = 'failed'
    return true
  }

  const retryFailedMessage = (chatId: string, localId: string) => {
    const list = messagesByChatId.value[chatId] || []
    const target = list.find((item) => item.localId === localId)
    if (!target || target.direction !== 'out' || target.status !== 'failed') {
      return null
    }

    if (target.sequence && sequenceIndex.value[target.sequence]) {
      delete sequenceIndex.value[target.sequence]
    }

    target.status = 'sending'
    target.sequence = undefined
    return { ...target }
  }

  const bindMessageSequence = (chatId: string, localId: string, sequence: string) => {
    const list = messagesByChatId.value[chatId] || []
    const target = list.find((item) => item.localId === localId)
    if (!target) return false

    if (target.sequence && sequenceIndex.value[target.sequence]) {
      delete sequenceIndex.value[target.sequence]
    }

    target.sequence = sequence
    sequenceIndex.value[sequence] = { chatId, localId }
    return true
  }

  const incrementUnread = (chatId: string) => {
    if (activeChatId.value === chatId) return
    unreadByChatId.value[chatId] = (unreadByChatId.value[chatId] || 0) + 1
  }

  const clearUnread = (chatId: string) => {
    unreadByChatId.value[chatId] = 0
  }

  const isPinned = (chatId: string) => !!pinnedChatIds.value[chatId]

  const pinChat = (chatId: string) => {
    pinnedChatIds.value[chatId] = true
  }

  const unpinChat = (chatId: string) => {
    delete pinnedChatIds.value[chatId]
  }

  const togglePinChat = (chatId: string) => {
    if (isPinned(chatId)) {
      unpinChat(chatId)
    } else {
      pinChat(chatId)
    }
  }

  const removeFromRecent = (chatId: string) => {
    hiddenRecentChatIds.value[chatId] = true
    clearUnread(chatId)
  }

  const restoreRecent = (chatId: string) => {
    if (hiddenRecentChatIds.value[chatId]) {
      delete hiddenRecentChatIds.value[chatId]
    }
  }

  const applySessionConfig = (payload: ChatSessionConfigPayload | null | undefined) => {
    const pinned = normalizeChatIdList(payload?.pinnedChatIds)
    const hidden = normalizeChatIdList(payload?.hiddenRecentChatIds)

    const nextPinned: Record<string, boolean> = {}
    pinned.forEach((chatId) => {
      nextPinned[chatId] = true
    })
    pinnedChatIds.value = nextPinned

    const nextHidden: Record<string, boolean> = {}
    hidden.forEach((chatId) => {
      nextHidden[chatId] = true
    })
    hiddenRecentChatIds.value = nextHidden
  }

  const exportSessionConfig = (): ChatSessionConfigPayload => ({
    pinnedChatIds: Object.keys(pinnedChatIds.value),
    hiddenRecentChatIds: Object.keys(hiddenRecentChatIds.value),
  })

  const resetSessionConfig = () => {
    pinnedChatIds.value = {}
    hiddenRecentChatIds.value = {}
  }

  return {
    activeChatId,
    sessionMap,
    messagesByChatId,
    unreadByChatId,
    sequenceIndex,
    pinnedChatIds,
    hiddenRecentChatIds,
    activeSession,
    recentChats,
    ensureSession,
    setActiveChat,
    getMessages,
    getActiveSessionMeta,
    appendOutgoingMessage,
    appendIncomingMessage,
    prependHistoryMessages,
    markMessageSentBySequence,
    markMessageFailedBySequence,
    retryFailedMessage,
    bindMessageSequence,
    incrementUnread,
    clearUnread,
    isPinned,
    pinChat,
    unpinChat,
    togglePinChat,
    removeFromRecent,
    restoreRecent,
    applySessionConfig,
    exportSessionConfig,
    resetSessionConfig,
  }
})
