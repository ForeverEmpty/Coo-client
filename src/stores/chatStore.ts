import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { chatApi } from '@/api/chat'
import { ContentType } from '@/api/enum'
import type { ChatHistoryMessage, RecentPrivateChatItemVO } from '@/api/types'
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

interface RecentChatSnapshot {
  session: ChatSessionMeta
  lastMessage: ChatUiMessage
  unreadCount: number
}

interface PersistedChatState {
  version: number
  sessionMap: Record<string, ChatSessionMeta>
  unreadByChatId: Record<string, number>
  pinnedChatIds: Record<string, boolean>
  hiddenRecentChatIds: Record<string, boolean>
  recentSnapshotByChatId: Record<string, RecentChatSnapshot>
}

const CHAT_STATE_VERSION = 1
const CHAT_STATE_STORAGE_PREFIX = 'coo:chat-state:v1:'

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

interface RefreshRecentOptions {
  currentUserId: string
  limit?: number
  friendMetaMap?: Record<string, { title: string; avatar?: string }>
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

const resolveStorageKey = (userId: string) => `${CHAT_STATE_STORAGE_PREFIX}${userId}`

const toBooleanRecord = (value: unknown) => {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, boolean>>(
    (acc, [key, flag]) => {
      if (flag) acc[key] = true
      return acc
    },
    {},
  )
}

const toNumberRecord = (value: unknown) => {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>(
    (acc, [key, raw]) => {
      const next = Number(raw)
      if (Number.isFinite(next) && next >= 0) {
        acc[key] = next
      }
      return acc
    },
    {},
  )
}

const parseSessionMap = (value: unknown) => {
  if (!value || typeof value !== 'object') return {}
  const result: Record<string, ChatSessionMeta> = {}
  Object.entries(value as Record<string, unknown>).forEach(([chatId, raw]) => {
    if (!raw || typeof raw !== 'object') return
    const session = raw as Partial<ChatSessionMeta>
    result[chatId] = {
      id: String(session.id || chatId),
      title: String(session.title || chatId),
      avatar: session.avatar ? String(session.avatar) : '',
      type: session.type === 2 ? 2 : 1,
      subTitle: session.subTitle ? String(session.subTitle) : undefined,
    }
  })
  return result
}

const mapHistoryMessageToUi = (
  message: ChatHistoryMessage,
  currentUserId: string,
): ChatUiMessage | null => {
  if (!message || !message.fromId || !message.toId) return null
  const isOutgoing = message.fromId === currentUserId

  return {
    localId: message.id || randomID(),
    sequence: message.id || undefined,
    fromId: message.fromId,
    toId: message.toId,
    chatType: message.chatType === 2 ? 2 : 1,
    contentType: message.contentType ?? ContentType.TEXT,
    content: message.content || '',
    timestamp: normalizeTimestamp(message.timestamp),
    direction: isOutgoing ? 'out' : 'in',
    status: 'sent',
  }
}

const parseRecentSnapshotMap = (value: unknown) => {
  if (!value || typeof value !== 'object') return {}
  const result: Record<string, RecentChatSnapshot> = {}

  Object.entries(value as Record<string, unknown>).forEach(([chatId, raw]) => {
    if (!raw || typeof raw !== 'object') return
    const snapshotRaw = raw as Partial<RecentChatSnapshot>
    const sessionRaw = snapshotRaw.session
    const messageRaw = snapshotRaw.lastMessage as ChatUiMessage | undefined
    if (!sessionRaw || !messageRaw) return

    const session: ChatSessionMeta = {
      id: String(sessionRaw.id || chatId),
      title: String(sessionRaw.title || chatId),
      avatar: sessionRaw.avatar ? String(sessionRaw.avatar) : '',
      type: sessionRaw.type === 2 ? 2 : 1,
      subTitle: sessionRaw.subTitle ? String(sessionRaw.subTitle) : undefined,
    }

    const lastMessage: ChatUiMessage = {
      localId: String(messageRaw.localId || randomID()),
      sequence: messageRaw.sequence ? String(messageRaw.sequence) : undefined,
      fromId: String(messageRaw.fromId || ''),
      toId: String(messageRaw.toId || ''),
      chatType: messageRaw.chatType === 2 ? 2 : 1,
      contentType: Number(messageRaw.contentType ?? ContentType.TEXT),
      content: String(messageRaw.content || ''),
      timestamp: normalizeTimestamp(messageRaw.timestamp),
      direction: messageRaw.direction === 'out' ? 'out' : 'in',
      status: messageRaw.status === 'failed' ? 'failed' : messageRaw.status === 'sending' ? 'sending' : 'sent',
    }

    result[chatId] = {
      session,
      lastMessage,
      unreadCount: Math.max(0, Number(snapshotRaw.unreadCount || 0)),
    }
  })

  return result
}

export const useChatStore = defineStore('chat', () => {
  const activeChatId = ref<string | null>(null)
  const sessionMap = ref<Record<string, ChatSessionMeta>>({})
  const messagesByChatId = ref<Record<string, ChatUiMessage[]>>({})
  const unreadByChatId = ref<Record<string, number>>({})
  const sequenceIndex = ref<Record<string, SequencePointer>>({})
  const pinnedChatIds = ref<Record<string, boolean>>({})
  const hiddenRecentChatIds = ref<Record<string, boolean>>({})
  const recentSnapshotByChatId = ref<Record<string, RecentChatSnapshot>>({})

  const activeSession = computed(() => {
    if (!activeChatId.value) return null
    return sessionMap.value[activeChatId.value] || null
  })

  const recentChats = computed<RecentChatItem[]>(() => {
    const items: RecentChatItem[] = []

    Object.entries(recentSnapshotByChatId.value).forEach(([chatId, snapshot]) => {
      if (!snapshot) return
      if (hiddenRecentChatIds.value[chatId]) return

      const lastMessage = snapshot.lastMessage
      if (!lastMessage) return

      const fallback = createDefaultSessionMeta(chatId)
      const session = sessionMap.value[chatId] || snapshot.session || fallback

      items.push({
        chatId,
        title: session.title,
        avatar: session.avatar,
        type: session.type,
        subTitle: session.subTitle,
        lastMessage,
        lastMessageText: lastMessage.content || '',
        lastMessageTime: lastMessage.timestamp || 0,
        unreadCount: unreadByChatId.value[chatId] ?? snapshot.unreadCount ?? 0,
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

  const upsertRecentSnapshot = (chatId: string, lastMessage: ChatUiMessage) => {
    const session = sessionMap.value[chatId] || createDefaultSessionMeta(chatId)
    recentSnapshotByChatId.value[chatId] = {
      session: { ...session },
      lastMessage: { ...lastMessage },
      unreadCount: unreadByChatId.value[chatId] || 0,
    }
  }

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
    const snapshot = recentSnapshotByChatId.value[id]
    if (snapshot) {
      snapshot.session = { ...nextMeta }
    }
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
    upsertRecentSnapshot(chatId, message)

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
    upsertRecentSnapshot(chatId, message)
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
    const latest = merged[merged.length - 1]
    if (latest) {
      upsertRecentSnapshot(chatId, latest)
    }

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
    const snapshot = recentSnapshotByChatId.value[pointer.chatId]
    if (snapshot?.lastMessage.localId === target.localId) {
      snapshot.lastMessage = { ...target }
    }
    return true
  }

  const markMessageFailedBySequence = (sequence: string) => {
    const pointer = sequenceIndex.value[sequence]
    if (!pointer) return false

    const list = messagesByChatId.value[pointer.chatId] || []
    const target = list.find((item) => item.localId === pointer.localId)
    if (!target) return false

    target.status = 'failed'
    const snapshot = recentSnapshotByChatId.value[pointer.chatId]
    if (snapshot?.lastMessage.localId === target.localId) {
      snapshot.lastMessage = { ...target }
    }
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
    const snapshot = recentSnapshotByChatId.value[chatId]
    if (snapshot?.lastMessage.localId === target.localId) {
      snapshot.lastMessage = { ...target }
    }
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
    const snapshot = recentSnapshotByChatId.value[chatId]
    if (snapshot?.lastMessage.localId === target.localId) {
      snapshot.lastMessage = { ...target }
    }
    return true
  }

  const incrementUnread = (chatId: string) => {
    if (activeChatId.value === chatId) return
    unreadByChatId.value[chatId] = (unreadByChatId.value[chatId] || 0) + 1
    const snapshot = recentSnapshotByChatId.value[chatId]
    if (snapshot) {
      snapshot.unreadCount = unreadByChatId.value[chatId]
    }
  }

  const clearUnread = (chatId: string) => {
    unreadByChatId.value[chatId] = 0
    const snapshot = recentSnapshotByChatId.value[chatId]
    if (snapshot) {
      snapshot.unreadCount = 0
    }
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

  const resetRuntimeState = () => {
    activeChatId.value = null
    sessionMap.value = {}
    messagesByChatId.value = {}
    unreadByChatId.value = {}
    sequenceIndex.value = {}
    pinnedChatIds.value = {}
    hiddenRecentChatIds.value = {}
    recentSnapshotByChatId.value = {}
  }

  const persistRecentState = (userId: string) => {
    if (!userId) return

    const state: PersistedChatState = {
      version: CHAT_STATE_VERSION,
      sessionMap: sessionMap.value,
      unreadByChatId: unreadByChatId.value,
      pinnedChatIds: pinnedChatIds.value,
      hiddenRecentChatIds: hiddenRecentChatIds.value,
      recentSnapshotByChatId: recentSnapshotByChatId.value,
    }

    try {
      localStorage.setItem(resolveStorageKey(userId), JSON.stringify(state))
    } catch {
      // Ignore quota/storage errors and keep runtime state.
    }
  }

  const hydrateRecentState = (userId: string) => {
    if (!userId) return false
    let parsed: PersistedChatState | null = null

    try {
      const raw = localStorage.getItem(resolveStorageKey(userId))
      if (!raw) return false
      parsed = JSON.parse(raw) as PersistedChatState
    } catch {
      return false
    }

    if (!parsed || parsed.version !== CHAT_STATE_VERSION) {
      return false
    }

    sessionMap.value = parseSessionMap(parsed.sessionMap)
    unreadByChatId.value = toNumberRecord(parsed.unreadByChatId)
    pinnedChatIds.value = toBooleanRecord(parsed.pinnedChatIds)
    hiddenRecentChatIds.value = toBooleanRecord(parsed.hiddenRecentChatIds)
    recentSnapshotByChatId.value = parseRecentSnapshotMap(parsed.recentSnapshotByChatId)
    Object.entries(recentSnapshotByChatId.value).forEach(([chatId, snapshot]) => {
      if (!sessionMap.value[chatId]) {
        sessionMap.value[chatId] = { ...snapshot.session, id: chatId }
      }
    })
    activeChatId.value = null
    sequenceIndex.value = {}
    messagesByChatId.value = {}

    return Object.keys(recentSnapshotByChatId.value).length > 0
  }

  const hasRecentSnapshot = () => Object.keys(recentSnapshotByChatId.value).length > 0

  const mergeRecentItem = (
    item: RecentPrivateChatItemVO,
    currentUserId: string,
    friendMetaMap?: Record<string, { title: string; avatar?: string }>,
  ) => {
    const chatId = String(item.peerId || '')
    if (!chatId || !item.lastMessage) return

    const uiMessage = mapHistoryMessageToUi(item.lastMessage, currentUserId)
    if (!uiMessage) return

    const existing = sessionMap.value[chatId]
    const friendMeta = friendMetaMap?.[chatId]
    const existingTitle = existing?.title?.trim() || ''
    const hasNamedTitle = !!existingTitle && existingTitle !== chatId
    const title = hasNamedTitle ? existingTitle : friendMeta?.title || existingTitle || chatId
    const avatar = existing?.avatar || friendMeta?.avatar || ''

    ensureSession({
      id: chatId,
      title,
      avatar,
      type: 1,
      subTitle: existing?.subTitle || '在线',
    })

    const currentSnapshot = recentSnapshotByChatId.value[chatId]
    if (currentSnapshot && currentSnapshot.lastMessage.timestamp > uiMessage.timestamp) {
      return
    }

    upsertRecentSnapshot(chatId, uiMessage)
  }

  const refreshRecentFromServer = async (options: RefreshRecentOptions) => {
    const { currentUserId, limit = 50, friendMetaMap } = options
    if (!currentUserId) return

    const safeLimit = Math.max(1, Math.min(100, limit))
    const res = await chatApi.getRecentPrivateChats({ limit: safeLimit })
    const list = Array.isArray(res.data) ? res.data : []

    list.forEach((item) => {
      mergeRecentItem(item, currentUserId, friendMetaMap)
    })
  }

  return {
    activeChatId,
    sessionMap,
    messagesByChatId,
    unreadByChatId,
    sequenceIndex,
    pinnedChatIds,
    hiddenRecentChatIds,
    recentSnapshotByChatId,
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
    resetRuntimeState,
    persistRecentState,
    hydrateRecentState,
    hasRecentSnapshot,
    refreshRecentFromServer,
  }
})
