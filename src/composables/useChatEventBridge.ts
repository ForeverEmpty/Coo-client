import { onUnmounted } from 'vue'
import { ContentType } from '@/api/enum'
import type { ChatMessage, ChatRecallMessage, FriendGroup, GroupInfo, UserInfo } from '@/api/types'
import { socialApi } from '@/api/social'
import { platform } from '@/platform'
import { useChatStore } from '@/stores/chatStore'
import { useUserStore } from '@/stores/userStore'
import { wsManager } from '@/ws/manager'

let initialized = false
let friendDirectoryLoaded = false
const resolvingChatMeta = new Map<string, Promise<void>>()
const privateChatMetaCache = new Map<string, { title: string; avatar?: string }>()
const groupMetaCache = new Map<string, { title: string; avatar?: string; subTitle?: string }>()
let appFocused = true

const updateAppFocused = () => {
  if (typeof document === 'undefined') {
    appFocused = true
    return
  }
  const hasFocus = typeof document.hasFocus !== 'function' || document.hasFocus()
  appFocused = document.visibilityState === 'visible' && hasFocus
}

const buildNotificationBody = (data: ChatMessage) => {
  if (data.contentType === ContentType.IMAGE) return '[图片]'
  if (data.contentType === ContentType.FILE) {
    const name = String(data.fileName || data.content || '').trim()
    return name ? `[文件] ${name}` : '[文件]'
  }
  return String(data.content || '').trim() || '[新消息]'
}

const cacheFromFriendList = async () => {
  if (friendDirectoryLoaded) return

  const groups = (await socialApi.getFriendList()).data || ([] as FriendGroup[])
  groups.forEach((group) => {
    ;(group.children || []).forEach((friend) => {
      const title = friend.showName || friend.remark || friend.nickname || friend.id
      privateChatMetaCache.set(friend.id, {
        title,
        avatar: friend.avatar || '',
      })
    })
  })

  friendDirectoryLoaded = true
}

const hydratePrivateChatMeta = (chatStore: ReturnType<typeof useChatStore>, chatId: string) => {
  const existing = chatStore.sessionMap[chatId]
  if (existing?.title && existing.title !== chatId) return

  const cached = privateChatMetaCache.get(chatId)
  if (cached) {
    chatStore.ensureSession({
      id: chatId,
      title: cached.title,
      avatar: cached.avatar || existing?.avatar || '',
      type: 1,
      subTitle: existing?.subTitle || '在线',
    })
    return
  }

  if (resolvingChatMeta.has(chatId)) return

  const task = (async () => {
    try {
      await cacheFromFriendList()
      const fromList = privateChatMetaCache.get(chatId)
      if (fromList) {
        chatStore.ensureSession({
          id: chatId,
          title: fromList.title,
          avatar: fromList.avatar || existing?.avatar || '',
          type: 1,
          subTitle: existing?.subTitle || '在线',
        })
        return
      }

      const info = (await socialApi.getFriendInfo(chatId)).data as UserInfo | null
      if (!info) return

      const title = info.nickname || chatId
      const avatar = info.avatar || ''
      privateChatMetaCache.set(chatId, { title, avatar })

      chatStore.ensureSession({
        id: chatId,
        title,
        avatar: avatar || existing?.avatar || '',
        type: 1,
        subTitle: existing?.subTitle || '在线',
      })
    } catch {
      // keep id fallback
    } finally {
      resolvingChatMeta.delete(chatId)
    }
  })()

  resolvingChatMeta.set(chatId, task)
}

const hydrateGroupChatMeta = (chatStore: ReturnType<typeof useChatStore>, chatId: string) => {
  const existing = chatStore.sessionMap[chatId]
  const groupId = chatId.startsWith('group_') ? chatId.slice(6) : chatId
  const cached = groupMetaCache.get(groupId)
  if (cached) {
    chatStore.ensureSession({
      id: chatId,
      title: cached.title,
      avatar: cached.avatar || existing?.avatar || '',
      type: 2,
      subTitle: cached.subTitle || existing?.subTitle || '群聊',
    })
    return
  }

  if (resolvingChatMeta.has(chatId)) return

  const task = (async () => {
    try {
      const info = (await socialApi.getGroupInfo(groupId)).data as GroupInfo | null
      if (!info) return
      const title = info.remark || info.name || groupId
      const avatar = info.avatar || ''
      const subTitle = `${info.memberCount || 0} 人 · ${info.myTitleName || '群成员'}`
      groupMetaCache.set(groupId, { title, avatar, subTitle })
      chatStore.ensureSession({
        id: chatId,
        title,
        avatar,
        type: 2,
        subTitle,
      })
    } catch {
      // keep id fallback
    } finally {
      resolvingChatMeta.delete(chatId)
    }
  })()

  resolvingChatMeta.set(chatId, task)
}

export function useChatEventBridge() {
  if (initialized) return
  initialized = true

  const chatStore = useChatStore()
  const userStore = useUserStore()
  updateAppFocused()

  const handleWindowFocus = () => {
    appFocused = true
  }
  const handleWindowBlur = () => {
    appFocused = false
  }
  const handleVisibilityChange = () => {
    updateAppFocused()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('blur', handleWindowBlur)
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  const offChat = wsManager.subscribe('chat', (model) => {
    const data = model.data as ChatMessage | undefined
    if (!data || !data.fromId || !data.toId) return

    const currentUserId = userStore.userInfo?.id
    if (currentUserId && data.fromId === currentUserId) return

    const chatType = data.chatType as 1 | 2
    const chatId = chatType === 1 ? data.fromId : `group_${data.toId}`

    chatStore.ensureSession(chatId)
    if (chatType === 1) {
      hydratePrivateChatMeta(chatStore, chatId)
    } else {
      hydrateGroupChatMeta(chatStore, chatId)
    }

    chatStore.appendIncomingMessage(chatId, {
      sequence: model.sequence,
      fromId: data.fromId,
      toId: data.toId,
      chatType,
      contentType: data.contentType,
      content: data.content,
      url: data.url,
      fileName: data.fileName,
      fileSize: data.fileSize,
      timestamp: data.timestamp,
      replyTo: data.replyTo,
    })

    if (chatStore.activeChatId !== chatId) {
      chatStore.incrementUnread(chatId)
    }

    if (appFocused || chatStore.isMuted(chatId)) {
      return
    }

    const title = chatStore.sessionMap[chatId]?.title || (chatType === 2 ? '群消息' : '新消息')
    platform.notification.send(title, buildNotificationBody(data))
  })

  const offAck = wsManager.subscribe('ack', (model) => {
    if (!model.sequence) return
    chatStore.markMessageSentBySequence(model.sequence)
  })

  const offRecall = wsManager.subscribe('recall', (model) => {
    const data = model.data as ChatRecallMessage | undefined
    if (!data?.messageId || !data.fromId || !data.toId) return

    const chatId = data.chatType === 2 ? `group_${data.toId}` : data.fromId
    chatStore.markMessageRecalled(chatId, data.messageId)
  })

  onUnmounted(() => {
    offChat()
    offAck()
    offRecall()
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('blur', handleWindowBlur)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    initialized = false
  })
}
