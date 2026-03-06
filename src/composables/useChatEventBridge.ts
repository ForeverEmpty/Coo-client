import { onUnmounted } from 'vue'
import type { ChatMessage } from '@/api/types'
import { socialApi } from '@/api/social'
import { useChatStore } from '@/stores/chatStore'
import { useUserStore } from '@/stores/userStore'
import { wsManager } from '@/ws/manager'

let initialized = false
let friendDirectoryLoaded = false
const resolvingChatMeta = new Map<string, Promise<void>>()
const privateChatMetaCache = new Map<string, { title: string; avatar?: string }>()

const cacheFromFriendList = async () => {
  if (friendDirectoryLoaded) {
    return
  }

  const res = await socialApi.getFriendList()
  const groups = res.data || []
  for (const group of groups) {
    for (const friend of group.children || []) {
      const title = friend.showName || friend.remark || friend.nickname || friend.id
      privateChatMetaCache.set(friend.id, {
        title,
        avatar: friend.avatar || '',
      })
    }
  }
  friendDirectoryLoaded = true
}

const hydratePrivateChatMeta = (chatStore: ReturnType<typeof useChatStore>, chatId: string) => {
  const existing = chatStore.sessionMap[chatId]
  if (existing?.title && existing.title !== chatId) {
    return
  }

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

  if (resolvingChatMeta.has(chatId)) {
    return
  }

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

      const info = (await socialApi.getFriendInfo(chatId)).data
      if (!info) {
        return
      }

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
      // keep ID fallback when metadata request fails
    } finally {
      resolvingChatMeta.delete(chatId)
    }
  })()

  resolvingChatMeta.set(chatId, task)
}

export function useChatEventBridge() {
  if (initialized) {
    return
  }
  initialized = true

  const chatStore = useChatStore()
  const userStore = useUserStore()

  const offChat = wsManager.subscribe('chat', (model) => {
    const data = model.data as ChatMessage | undefined
    if (!data || !data.fromId || !data.toId) {
      return
    }

    const currentUserId = userStore.userInfo?.id
    if (currentUserId && data.fromId === currentUserId) {
      return
    }
    const chatType = data.chatType as 1 | 2
    const chatId =
      chatType === 1
        ? currentUserId && data.fromId === currentUserId
          ? data.toId
          : data.fromId
        : `group_${data.toId}`

    chatStore.ensureSession(chatId)
    if (chatType === 1) {
      hydratePrivateChatMeta(chatStore, chatId)
    }
    chatStore.appendIncomingMessage(chatId, {
      sequence: model.sequence,
      fromId: data.fromId,
      toId: data.toId,
      chatType,
      contentType: data.contentType,
      content: data.content,
      timestamp: data.timestamp,
    })

    if (chatStore.activeChatId !== chatId) {
      chatStore.incrementUnread(chatId)
    }
  })

  const offAck = wsManager.subscribe('ack', (model) => {
    if (!model.sequence) {
      return
    }
    chatStore.markMessageSentBySequence(model.sequence)
  })

  onUnmounted(() => {
    offChat()
    offAck()
    initialized = false
  })
}
