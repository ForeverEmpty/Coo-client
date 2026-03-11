import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { chatApi } from '@/api/chat'
import { ContentType } from '@/api/enum'
import { platform } from '@/platform'
import type { ChatHistoryMessage, RecentPrivateChatItemVO } from '@/api/types'
import { randomID } from '@/utils/randomID'

export type ChatSessionType = 1 | 2
export type ChatMessageStatus = 'sending' | 'sent' | 'failed' | 'recalled'
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
  url?: string
  fileName?: string
  fileSize?: number
  timestamp: number
  direction: ChatMessageDirection
  status: ChatMessageStatus
  replyTo?: {
    messageId?: string
    senderName?: string
    content?: string
  }
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
  mutedChatIds: string[]
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
  mutedChatIds?: Record<string, boolean>
  recentSnapshotByChatId: Record<string, RecentChatSnapshot>
  cachedMessagesByChatId?: Record<string, ChatUiMessage[]>
  lastActiveAtByChatId?: Record<string, number>
}

export type ChatCacheMode = 'electron' | 'remote-only'
export interface ChatStorageConfig {
  directory: string
  globalLimitMB: number
  perChatLimitMB: number
}

const CHAT_STATE_VERSION = 3
const CHAT_STATE_STORAGE_PREFIX = 'coo:chat-state:v2:'
const LEGACY_CHAT_STATE_STORAGE_PREFIX = 'coo:chat-state:v1:'
const DEFAULT_GLOBAL_LIMIT_MB = 256
const DEFAULT_PER_CHAT_LIMIT_MB = 32
const PER_CHAT_MAX_MESSAGES = 2000
const GLOBAL_MAX_MESSAGES = 30000

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
  url?: string
  fileName?: string
  fileSize?: number
  timestamp?: number | string
  replyTo?: {
    messageId?: string
    senderName?: string
    content?: string
  }
}

interface IncomingMessageInput {
  localId?: string
  sequence?: string
  fromId: string
  toId: string
  chatType: ChatSessionType
  contentType?: number
  content: string
  url?: string
  fileName?: string
  fileSize?: number
  timestamp?: number | string
  replyTo?: {
    messageId?: string
    senderName?: string
    content?: string
  }
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

const isPrivateChatId = (chatId: string) => !chatId.startsWith('group_')

const normalizeMessageStatus = (status: unknown): ChatMessageStatus => {
  if (status === 'sending' || status === 'failed' || status === 'sent' || status === 'recalled') {
    return status
  }
  return 'sent'
}

const estimateMessageBytes = (message: ChatUiMessage) => {
  try {
    return new TextEncoder().encode(
      JSON.stringify({
        localId: message.localId,
        sequence: message.sequence || '',
        fromId: message.fromId,
        toId: message.toId,
        chatType: message.chatType,
        contentType: message.contentType,
        content: message.content,
        url: message.url || '',
        fileName: message.fileName || '',
        fileSize: message.fileSize || 0,
        timestamp: message.timestamp,
        direction: message.direction,
        status: message.status,
        replyTo: message.replyTo || undefined,
      }),
    ).length
  } catch {
    return 0
  }
}

const toRecentMessageText = (message: ChatUiMessage) => {
  if (message.status === 'recalled') {
    return '[已撤回]'
  }
  if (message.contentType === ContentType.IMAGE) {
    return '[图片]'
  }
  if (message.contentType === ContentType.FILE) {
    const name = (message.fileName || message.content || '').trim()
    return name ? `[文件] ${name}` : '[文件]'
  }
  return message.content || ''
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
const resolveLegacyStorageKey = (userId: string) => `${LEGACY_CHAT_STATE_STORAGE_PREFIX}${userId}`
const createDefaultStorageConfig = (): ChatStorageConfig => ({
  directory: '',
  globalLimitMB: DEFAULT_GLOBAL_LIMIT_MB,
  perChatLimitMB: DEFAULT_PER_CHAT_LIMIT_MB,
})

const normalizeStorageConfig = (value?: Partial<ChatStorageConfig>): ChatStorageConfig => {
  const globalLimitMB = Math.max(
    1,
    Math.floor(Number(value?.globalLimitMB || DEFAULT_GLOBAL_LIMIT_MB)),
  )
  const perChatRaw = Math.max(1, Math.floor(Number(value?.perChatLimitMB || DEFAULT_PER_CHAT_LIMIT_MB)))
  const perChatLimitMB = Math.min(perChatRaw, globalLimitMB)

  return {
    directory: String(value?.directory || '').trim(),
    globalLimitMB,
    perChatLimitMB,
  }
}

const parsePersistedState = (raw: string | null): PersistedChatState | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedChatState
    if (!parsed || ![1, 2, CHAT_STATE_VERSION].includes(parsed.version)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

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
  const isRecalled = Number(message.status) === 1

  return {
    localId: message.id || randomID(),
    sequence: message.id || undefined,
    fromId: message.fromId,
    toId: message.toId,
    chatType: message.chatType === 2 ? 2 : 1,
    contentType: message.contentType ?? ContentType.TEXT,
    content: isRecalled ? '[已撤回]' : message.content || '',
    url: message.url || '',
    fileName: message.fileName || '',
    fileSize:
      typeof message.fileSize === 'number' && Number.isFinite(message.fileSize)
        ? message.fileSize
        : undefined,
    timestamp: normalizeTimestamp(message.timestamp),
    direction: isOutgoing ? 'out' : 'in',
    status: isRecalled ? 'recalled' : 'sent',
    replyTo: message.replyTo
      ? {
          messageId: message.replyTo.messageId,
          senderName: message.replyTo.senderName,
          content: message.replyTo.content,
        }
      : undefined,
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
      url: messageRaw.url ? String(messageRaw.url) : '',
      fileName: messageRaw.fileName ? String(messageRaw.fileName) : '',
      fileSize:
        typeof messageRaw.fileSize === 'number' && Number.isFinite(messageRaw.fileSize)
          ? messageRaw.fileSize
          : undefined,
      timestamp: normalizeTimestamp(messageRaw.timestamp),
      direction: messageRaw.direction === 'out' ? 'out' : 'in',
      status: normalizeMessageStatus(messageRaw.status),
      replyTo: messageRaw.replyTo
        ? {
            messageId: messageRaw.replyTo.messageId,
            senderName: messageRaw.replyTo.senderName,
            content: messageRaw.replyTo.content,
          }
        : undefined,
    }

    result[chatId] = {
      session,
      lastMessage,
      unreadCount: Math.max(0, Number(snapshotRaw.unreadCount || 0)),
    }
  })

  return result
}

const parseCachedMessagesByChatId = (value: unknown) => {
  if (!value || typeof value !== 'object') return {}
  const result: Record<string, ChatUiMessage[]> = {}

  Object.entries(value as Record<string, unknown>).forEach(([chatId, rawList]) => {
    if (!isPrivateChatId(chatId)) return
    if (!Array.isArray(rawList)) return

    const parsedList: ChatUiMessage[] = []
    rawList.forEach((rawItem) => {
      if (!rawItem || typeof rawItem !== 'object') return
      const item = rawItem as Partial<ChatUiMessage>
      if (!item.fromId || !item.toId) return

      parsedList.push({
        localId: String(item.localId || randomID()),
        sequence: item.sequence ? String(item.sequence) : undefined,
        fromId: String(item.fromId),
        toId: String(item.toId),
        chatType: item.chatType === 2 ? 2 : 1,
        contentType: Number(item.contentType ?? ContentType.TEXT),
        content: String(item.content || ''),
        url: item.url ? String(item.url) : '',
        fileName: item.fileName ? String(item.fileName) : '',
        fileSize:
          typeof item.fileSize === 'number' && Number.isFinite(item.fileSize)
            ? item.fileSize
            : undefined,
        timestamp: normalizeTimestamp(item.timestamp),
        direction: item.direction === 'out' ? 'out' : 'in',
        status: normalizeMessageStatus(item.status),
        replyTo: item.replyTo
          ? {
              messageId: item.replyTo.messageId,
              senderName: item.replyTo.senderName,
              content: item.replyTo.content,
            }
          : undefined,
      })
    })

    if (parsedList.length > 0) {
      result[chatId] = parsedList.sort((a, b) => a.timestamp - b.timestamp)
    }
  })

  return result
}

export const useChatStore = defineStore('chat', () => {
  const cacheMode = ref<ChatCacheMode>(platform.name === 'electron' ? 'electron' : 'remote-only')
  const storageConfig = ref<ChatStorageConfig>(createDefaultStorageConfig())
  const activeChatId = ref<string | null>(null)
  const sessionMap = ref<Record<string, ChatSessionMeta>>({})
  const messagesByChatId = ref<Record<string, ChatUiMessage[]>>({})
  const unreadByChatId = ref<Record<string, number>>({})
  const sequenceIndex = ref<Record<string, SequencePointer>>({})
  const pinnedChatIds = ref<Record<string, boolean>>({})
  const hiddenRecentChatIds = ref<Record<string, boolean>>({})
  const mutedChatIds = ref<Record<string, boolean>>({})
  const recentSnapshotByChatId = ref<Record<string, RecentChatSnapshot>>({})
  const lastActiveAtByChatId = ref<Record<string, number>>({})
  const messageBytesByChatId = ref<Record<string, number>>({})

  const isLocalMessageCacheEnabled = computed(() => cacheMode.value === 'electron')
  const perChatMaxBytes = computed(() => storageConfig.value.perChatLimitMB * 1024 * 1024)
  const globalMaxBytes = computed(() => storageConfig.value.globalLimitMB * 1024 * 1024)

  const removeMessageFromSequenceIndex = (chatId: string, message: ChatUiMessage) => {
    const sequence = message.sequence
    if (!sequence) return
    const pointer = sequenceIndex.value[sequence]
    if (!pointer) return
    if (pointer.chatId === chatId && pointer.localId === message.localId) {
      delete sequenceIndex.value[sequence]
    }
  }

  const recalcChatBytes = (chatId: string) => {
    const list = messagesByChatId.value[chatId] || []
    if (list.length === 0) {
      delete messageBytesByChatId.value[chatId]
      return 0
    }
    const bytes = list.reduce((sum, item) => sum + estimateMessageBytes(item), 0)
    messageBytesByChatId.value[chatId] = bytes
    return bytes
  }

  const touchChatActivity = (chatId: string, timestamp?: number) => {
    if (!isPrivateChatId(chatId)) return
    const next = typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : Date.now()
    lastActiveAtByChatId.value[chatId] = next
  }

  const removeOldestMessage = (chatId: string) => {
    const list = messagesByChatId.value[chatId]
    if (!list || list.length === 0) return false

    const removed = list.shift()
    if (!removed) return false

    removeMessageFromSequenceIndex(chatId, removed)

    if (list.length === 0) {
      delete messagesByChatId.value[chatId]
      delete messageBytesByChatId.value[chatId]
    } else {
      recalcChatBytes(chatId)
    }

    return true
  }

  const trimPerChatCache = (chatId: string) => {
    if (!isLocalMessageCacheEnabled.value || !isPrivateChatId(chatId)) return

    const list = messagesByChatId.value[chatId]
    if (!list || list.length === 0) return

    recalcChatBytes(chatId)
    while (
      list.length > PER_CHAT_MAX_MESSAGES ||
      ((messageBytesByChatId.value[chatId] || 0) > perChatMaxBytes.value && list.length > 0)
    ) {
      if (!removeOldestMessage(chatId)) break
    }
  }

  const trimGlobalCache = () => {
    if (!isLocalMessageCacheEnabled.value) return

    const calculateTotals = () => {
      let totalCount = 0
      let totalBytes = 0
      const chatIds: string[] = []

      Object.entries(messagesByChatId.value).forEach(([chatId, list]) => {
        if (!isPrivateChatId(chatId)) return
        if (!list || list.length === 0) return
        chatIds.push(chatId)
        totalCount += list.length
        totalBytes += messageBytesByChatId.value[chatId] ?? recalcChatBytes(chatId)
      })

      return { totalCount, totalBytes, chatIds }
    }

    let totals = calculateTotals()
    while (totals.totalCount > GLOBAL_MAX_MESSAGES || totals.totalBytes > globalMaxBytes.value) {
      if (totals.chatIds.length === 0) break

      const candidate = totals.chatIds
        .filter((chatId) => (messagesByChatId.value[chatId] || []).length > 0)
        .sort((a, b) => {
          const aActive = lastActiveAtByChatId.value[a] || 0
          const bActive = lastActiveAtByChatId.value[b] || 0
          if (aActive !== bActive) return aActive - bActive
          return a.localeCompare(b)
        })[0]

      if (!candidate) break
      const removed = removeOldestMessage(candidate)
      if (!removed) break
      totals = calculateTotals()
    }
  }

  const enforceMessageCacheLimit = (chatId: string) => {
    if (!isLocalMessageCacheEnabled.value) return
    if (!isPrivateChatId(chatId)) return
    trimPerChatCache(chatId)
    trimGlobalCache()
  }

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
        lastMessageText: toRecentMessageText(lastMessage),
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

  const refreshRecentSnapshot = (chatId: string) => {
    const list = messagesByChatId.value[chatId] || []
    const latest = list.length > 0 ? list[list.length - 1] : null
    if (!latest) {
      delete recentSnapshotByChatId.value[chatId]
      return
    }
    upsertRecentSnapshot(chatId, latest)
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
    touchChatActivity(meta.id)
  }

  const getMessages = (chatId: string | null) => {
    if (!chatId) return []
    return messagesByChatId.value[chatId] || []
  }

  const getMessageByLocalId = (chatId: string, localId: string) => {
    const list = messagesByChatId.value[chatId] || []
    return list.find((item) => item.localId === localId) || null
  }

  const hasCachedMessages = (chatId: string) => {
    if (!isLocalMessageCacheEnabled.value) return false
    if (!isPrivateChatId(chatId)) return false
    return (messagesByChatId.value[chatId] || []).length > 0
  }

  const getCachedOldestTimestamp = (chatId: string) => {
    const list = messagesByChatId.value[chatId] || []
    if (list.length === 0) return null
    return list[0]?.timestamp ?? null
  }

  const getActiveSessionMeta = () => activeSession.value

  const removeLocalMessages = (chatId: string, localIds: string[]) => {
    if (!chatId || !localIds.length) return 0
    const set = new Set(localIds)
    const list = messagesByChatId.value[chatId] || []
    if (!list.length) return 0

    const next = list.filter((item) => {
      if (!set.has(item.localId)) return true
      removeMessageFromSequenceIndex(chatId, item)
      return false
    })

    const removedCount = list.length - next.length
    if (removedCount <= 0) return 0

    if (next.length === 0) {
      delete messagesByChatId.value[chatId]
      delete messageBytesByChatId.value[chatId]
      delete lastActiveAtByChatId.value[chatId]
    } else {
      messagesByChatId.value[chatId] = next
      recalcChatBytes(chatId)
      const latest = next[next.length - 1]
      if (latest) {
        touchChatActivity(chatId, latest.timestamp)
      }
    }

    refreshRecentSnapshot(chatId)
    return removedCount
  }

  const removeLocalMessage = (chatId: string, localId: string) => removeLocalMessages(chatId, [localId])

  const markMessageRecalled = (chatId: string, messageId: string) => {
    const list = messagesByChatId.value[chatId] || []
    if (!list.length) return false

    let changed = false
    list.forEach((item) => {
      const matched = item.localId === messageId || item.sequence === messageId
      if (!matched) return
      if (item.status === 'recalled') {
        changed = true
        return
      }
      item.status = 'recalled'
      item.content = '[已撤回]'
      item.url = ''
      item.fileName = ''
      item.fileSize = undefined
      item.replyTo = undefined
      changed = true
    })

    if (!changed) return false
    recalcChatBytes(chatId)
    refreshRecentSnapshot(chatId)
    return true
  }

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
      url: payload.url || '',
      fileName: payload.fileName || '',
      fileSize: payload.fileSize,
      timestamp: normalizeTimestamp(payload.timestamp),
      direction: 'out',
      status: 'sending',
      replyTo: payload.replyTo
        ? {
            messageId: payload.replyTo.messageId,
            senderName: payload.replyTo.senderName,
            content: payload.replyTo.content,
          }
        : undefined,
    }

    const list = messagesByChatId.value[chatId] || []
    messagesByChatId.value[chatId] = [...list, message]
    upsertRecentSnapshot(chatId, message)
    touchChatActivity(chatId, message.timestamp)
    recalcChatBytes(chatId)
    enforceMessageCacheLimit(chatId)

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
      url: payload.url || '',
      fileName: payload.fileName || '',
      fileSize: payload.fileSize,
      timestamp: normalizeTimestamp(payload.timestamp),
      direction: 'in',
      status: 'sent',
      replyTo: payload.replyTo
        ? {
            messageId: payload.replyTo.messageId,
            senderName: payload.replyTo.senderName,
            content: payload.replyTo.content,
          }
        : undefined,
    }

    const list = messagesByChatId.value[chatId] || []
    messagesByChatId.value[chatId] = [...list, message]
    upsertRecentSnapshot(chatId, message)
    touchChatActivity(chatId, message.timestamp)
    recalcChatBytes(chatId)
    enforceMessageCacheLimit(chatId)
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
    const mergedLast = merged.length > 0 ? merged[merged.length - 1] : undefined
    if (mergedLast) {
      touchChatActivity(chatId, mergedLast.timestamp)
    }
    recalcChatBytes(chatId)
    enforceMessageCacheLimit(chatId)
    const latest = mergedLast
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
    if (target.status === 'recalled') return true

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
    if (target.status === 'recalled') return true

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

  const patchMessage = (
    chatId: string,
    localId: string,
    patch: Partial<Pick<ChatUiMessage, 'sequence' | 'content' | 'url' | 'fileName' | 'fileSize' | 'status'>>,
  ) => {
    const list = messagesByChatId.value[chatId] || []
    const target = list.find((item) => item.localId === localId)
    if (!target) return false

    if (patch.sequence !== undefined) {
      if (target.sequence && sequenceIndex.value[target.sequence]) {
        delete sequenceIndex.value[target.sequence]
      }
      target.sequence = patch.sequence
      if (patch.sequence) {
        sequenceIndex.value[patch.sequence] = { chatId, localId }
      }
    }

    if (patch.content !== undefined) target.content = patch.content
    if (patch.url !== undefined) target.url = patch.url
    if (patch.fileName !== undefined) target.fileName = patch.fileName
    if (patch.fileSize !== undefined) target.fileSize = patch.fileSize
    if (patch.status !== undefined) target.status = patch.status

    const snapshot = recentSnapshotByChatId.value[chatId]
    if (snapshot?.lastMessage.localId === target.localId) {
      snapshot.lastMessage = { ...target }
    }
    recalcChatBytes(chatId)
    enforceMessageCacheLimit(chatId)
    return true
  }

  const markMessageFailedByLocalId = (chatId: string, localId: string) => {
    return patchMessage(chatId, localId, { status: 'failed' })
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

  const isMuted = (chatId: string) => !!mutedChatIds.value[chatId]

  const muteChat = (chatId: string) => {
    mutedChatIds.value[chatId] = true
  }

  const unmuteChat = (chatId: string) => {
    delete mutedChatIds.value[chatId]
  }

  const toggleMuteChat = (chatId: string) => {
    if (isMuted(chatId)) {
      unmuteChat(chatId)
      return
    }
    muteChat(chatId)
  }

  const applySessionConfig = (payload: ChatSessionConfigPayload | null | undefined) => {
    const pinned = normalizeChatIdList(payload?.pinnedChatIds)
    const hidden = normalizeChatIdList(payload?.hiddenRecentChatIds)
    const muted = normalizeChatIdList(payload?.mutedChatIds)

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

    const nextMuted: Record<string, boolean> = {}
    muted.forEach((chatId) => {
      nextMuted[chatId] = true
    })
    mutedChatIds.value = nextMuted
  }

  const exportSessionConfig = (): ChatSessionConfigPayload => ({
    pinnedChatIds: Object.keys(pinnedChatIds.value),
    hiddenRecentChatIds: Object.keys(hiddenRecentChatIds.value),
    mutedChatIds: Object.keys(mutedChatIds.value),
  })

  const resetSessionConfig = () => {
    pinnedChatIds.value = {}
    hiddenRecentChatIds.value = {}
    mutedChatIds.value = {}
  }

  const resetRuntimeState = () => {
    activeChatId.value = null
    sessionMap.value = {}
    messagesByChatId.value = {}
    unreadByChatId.value = {}
    sequenceIndex.value = {}
    pinnedChatIds.value = {}
    hiddenRecentChatIds.value = {}
    mutedChatIds.value = {}
    recentSnapshotByChatId.value = {}
    lastActiveAtByChatId.value = {}
    messageBytesByChatId.value = {}
  }

  const loadStorageConfig = async () => {
    if (platform.name !== 'electron') {
      storageConfig.value = createDefaultStorageConfig()
      return storageConfig.value
    }

    try {
      const config = await platform.chatStorage.getConfig()
      storageConfig.value = normalizeStorageConfig(config)
    } catch {
      storageConfig.value = createDefaultStorageConfig()
    }

    return storageConfig.value
  }

  const saveStorageConfig = async (next: Partial<ChatStorageConfig>) => {
    const normalized = normalizeStorageConfig({
      ...storageConfig.value,
      ...next,
    })

    if (platform.name !== 'electron') {
      storageConfig.value = normalized
      return normalized
    }

    const saved = await platform.chatStorage.setConfig(normalized)
    storageConfig.value = normalizeStorageConfig(saved)
    trimGlobalCache()
    return storageConfig.value
  }

  const chooseStorageDirectory = async () => {
    if (platform.name !== 'electron') return null
    const selected = await platform.chatStorage.chooseDirectory()
    if (!selected) return null
    const saved = await saveStorageConfig({ directory: selected })
    return saved.directory
  }

  const buildPersistedState = (): PersistedChatState => {
    const cachedMessagesByChatId = isLocalMessageCacheEnabled.value
      ? Object.entries(messagesByChatId.value).reduce<Record<string, ChatUiMessage[]>>(
          (acc, [chatId, list]) => {
            if (!isPrivateChatId(chatId)) return acc
            if (!Array.isArray(list) || list.length === 0) return acc
            acc[chatId] = list
            return acc
          },
          {},
        )
      : undefined

    const lastActiveRecord = isLocalMessageCacheEnabled.value
      ? Object.entries(lastActiveAtByChatId.value).reduce<Record<string, number>>(
          (acc, [chatId, timestamp]) => {
            if (!isPrivateChatId(chatId)) return acc
            if (!Number.isFinite(timestamp) || timestamp <= 0) return acc
            acc[chatId] = timestamp
            return acc
          },
          {},
        )
      : undefined

    return {
      version: CHAT_STATE_VERSION,
      sessionMap: sessionMap.value,
      unreadByChatId: unreadByChatId.value,
      pinnedChatIds: pinnedChatIds.value,
      hiddenRecentChatIds: hiddenRecentChatIds.value,
      mutedChatIds: mutedChatIds.value,
      recentSnapshotByChatId: recentSnapshotByChatId.value,
      cachedMessagesByChatId:
        cachedMessagesByChatId && Object.keys(cachedMessagesByChatId).length > 0
          ? cachedMessagesByChatId
          : undefined,
      lastActiveAtByChatId:
        lastActiveRecord && Object.keys(lastActiveRecord).length > 0
          ? lastActiveRecord
          : undefined,
    }
  }

  const applyPersistedState = (parsed: PersistedChatState) => {
    sessionMap.value = parseSessionMap(parsed.sessionMap)
    unreadByChatId.value = toNumberRecord(parsed.unreadByChatId)
    pinnedChatIds.value = toBooleanRecord(parsed.pinnedChatIds)
    hiddenRecentChatIds.value = toBooleanRecord(parsed.hiddenRecentChatIds)
    mutedChatIds.value = toBooleanRecord(parsed.mutedChatIds)
    recentSnapshotByChatId.value = parseRecentSnapshotMap(parsed.recentSnapshotByChatId)
    Object.entries(recentSnapshotByChatId.value).forEach(([chatId, snapshot]) => {
      if (!sessionMap.value[chatId]) {
        sessionMap.value[chatId] = { ...snapshot.session, id: chatId }
      }
    })
    activeChatId.value = null
    sequenceIndex.value = {}
    messageBytesByChatId.value = {}
    if (isLocalMessageCacheEnabled.value) {
      messagesByChatId.value = parseCachedMessagesByChatId(parsed.cachedMessagesByChatId)
      lastActiveAtByChatId.value = toNumberRecord(parsed.lastActiveAtByChatId)

      Object.entries(messagesByChatId.value).forEach(([chatId, list]) => {
        if (!isPrivateChatId(chatId)) {
          delete messagesByChatId.value[chatId]
          return
        }
        if (list.length === 0) {
          delete messagesByChatId.value[chatId]
          return
        }
        const listLast = list.length > 0 ? list[list.length - 1] : undefined
        if (!lastActiveAtByChatId.value[chatId]) {
          lastActiveAtByChatId.value[chatId] = listLast?.timestamp || Date.now()
        }
        recalcChatBytes(chatId)
        enforceMessageCacheLimit(chatId)
      })
    } else {
      messagesByChatId.value = {}
      lastActiveAtByChatId.value = {}
    }
  }

  const readLegacyLocalState = (userId: string) => {
    const raw =
      localStorage.getItem(resolveStorageKey(userId)) ||
      localStorage.getItem(resolveLegacyStorageKey(userId))
    return parsePersistedState(raw)
  }

  const clearLegacyLocalState = (userId: string) => {
    localStorage.removeItem(resolveStorageKey(userId))
    localStorage.removeItem(resolveLegacyStorageKey(userId))
  }

  const persistRecentState = async (userId: string) => {
    if (!userId || !isLocalMessageCacheEnabled.value) return

    const state = buildPersistedState()
    if (platform.name !== 'electron') {
      try {
        localStorage.setItem(resolveStorageKey(userId), JSON.stringify(state))
      } catch {
        // Ignore storage write errors.
      }
      return
    }

    try {
      await platform.chatStorage.writeState({
        userId,
        payload: JSON.stringify(state),
      })
    } catch {
      // Keep runtime state when file write fails.
    }
  }

  const hydrateRecentState = async (userId: string) => {
    if (!userId) return false
    if (!isLocalMessageCacheEnabled.value) return false

    await loadStorageConfig()

    let parsed: PersistedChatState | null = null
    if (platform.name === 'electron') {
      try {
        const raw = await platform.chatStorage.readState(userId)
        parsed = parsePersistedState(raw)
      } catch {
        parsed = null
      }
    }

    if (!parsed) {
      const legacyState = readLegacyLocalState(userId)
      if (!legacyState) return false
      applyPersistedState(legacyState)
      if (platform.name === 'electron') {
        try {
          await platform.chatStorage.writeState({
            userId,
            payload: JSON.stringify(buildPersistedState()),
          })
          clearLegacyLocalState(userId)
        } catch {
          // Keep hydrated runtime state even if migration write fails.
        }
      }
      return (
        Object.keys(recentSnapshotByChatId.value).length > 0 ||
        Object.keys(messagesByChatId.value).length > 0
      )
    }

    applyPersistedState(parsed)

    return (
      Object.keys(recentSnapshotByChatId.value).length > 0 ||
      Object.keys(messagesByChatId.value).length > 0
    )
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
    cacheMode,
    storageConfig,
    isLocalMessageCacheEnabled,
    activeChatId,
    sessionMap,
    messagesByChatId,
    lastActiveAtByChatId,
    unreadByChatId,
    sequenceIndex,
    pinnedChatIds,
    hiddenRecentChatIds,
    mutedChatIds,
    recentSnapshotByChatId,
    activeSession,
    recentChats,
    ensureSession,
    setActiveChat,
    getMessages,
    getMessageByLocalId,
    hasCachedMessages,
    getCachedOldestTimestamp,
    getActiveSessionMeta,
    appendOutgoingMessage,
    appendIncomingMessage,
    prependHistoryMessages,
    markMessageSentBySequence,
    markMessageFailedBySequence,
    retryFailedMessage,
    removeLocalMessage,
    removeLocalMessages,
    markMessageRecalled,
    patchMessage,
    markMessageFailedByLocalId,
    bindMessageSequence,
    incrementUnread,
    clearUnread,
    isPinned,
    pinChat,
    unpinChat,
    togglePinChat,
    removeFromRecent,
    restoreRecent,
    isMuted,
    muteChat,
    unmuteChat,
    toggleMuteChat,
    applySessionConfig,
    exportSessionConfig,
    resetSessionConfig,
    resetRuntimeState,
    loadStorageConfig,
    saveStorageConfig,
    chooseStorageDirectory,
    persistRecentState,
    hydrateRecentState,
    hasRecentSnapshot,
    refreshRecentFromServer,
  }
})
