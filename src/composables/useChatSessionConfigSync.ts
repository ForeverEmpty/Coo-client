import { useDebounceFn } from '@vueuse/core'
import { onUnmounted, watch } from 'vue'
import { socialApi } from '@/api/social'
import { useChatStore } from '@/stores/chatStore'
import { useUserStore } from '@/stores/userStore'

let initialized = false

export function useChatSessionConfigSync() {
  if (initialized) {
    return
  }
  initialized = true

  const userStore = useUserStore()
  const chatStore = useChatStore()

  let hydrating = false
  let syncedUserId: string | null = null

  const buildFriendMetaMap = async () => {
    const map: Record<string, { title: string; avatar?: string }> = {}
    try {
      const res = await socialApi.getFriendList()
      ;(res.data || []).forEach((group) => {
        ;(group.children || []).forEach((friend) => {
          const title = friend.showName || friend.remark || friend.nickname || friend.id
          map[String(friend.id)] = {
            title: String(title || friend.id),
            avatar: friend.avatar || '',
          }
        })
      })
    } catch {
      // Keep empty mapping when friend list is unavailable.
    }
    return map
  }

  const persistConfig = useDebounceFn(async () => {
    const token = userStore.token
    const userId = userStore.userInfo?.id
    if (!token || !userId) return
    if (hydrating || syncedUserId !== userId) return

    try {
      await socialApi.saveChatSessionConfig(chatStore.exportSessionConfig())
    } catch {
      // Keep local state when sync fails; next change will retry.
    }
  }, 400)

  const persistRecentState = useDebounceFn(() => {
    const token = userStore.token
    const userId = userStore.userInfo?.id
    if (!token || !userId) return
    if (hydrating || syncedUserId !== userId) return
    void chatStore.persistRecentState(userId)
  }, 150)

  const stopAuthWatch = watch(
    () => [userStore.token, userStore.userInfo?.id] as const,
    async ([token, userId]) => {
      if (!token || !userId) {
        syncedUserId = null
        chatStore.resetRuntimeState()
        return
      }

      if (syncedUserId === userId) {
        return
      }

      hydrating = true
      try {
        chatStore.resetRuntimeState()

        await chatStore.loadStorageConfig()
        const hasLocal = await chatStore.hydrateRecentState(userId)

        try {
          const res = await socialApi.getChatSessionConfig()
          chatStore.applySessionConfig(res.data)
        } catch {
          // Keep local pinned/hidden state when remote config request fails.
        }

        const friendMetaMap = await buildFriendMetaMap()
        const refreshPromise = chatStore
          .refreshRecentFromServer({
            currentUserId: userId,
            friendMetaMap,
            limit: 50,
          })
          .catch(() => {
            // Keep local list when backend refresh fails.
          })

        if (!hasLocal) {
          await refreshPromise
        } else {
          void refreshPromise
        }
      } catch {
        // Keep local/runtime state when hydration chain fails.
      } finally {
        hydrating = false
        syncedUserId = userId
        void chatStore.persistRecentState(userId)
      }
    },
    { immediate: true },
  )

  const stopConfigWatch = watch(
    () => [chatStore.pinnedChatIds, chatStore.hiddenRecentChatIds] as const,
    () => {
      void persistConfig()
    },
    { deep: true },
  )

  const stopRecentStateWatch = watch(
    () =>
      [
        chatStore.sessionMap,
        chatStore.messagesByChatId,
        chatStore.lastActiveAtByChatId,
        chatStore.unreadByChatId,
        chatStore.pinnedChatIds,
        chatStore.hiddenRecentChatIds,
        chatStore.recentSnapshotByChatId,
      ] as const,
    () => {
      persistRecentState()
    },
    { deep: true },
  )

  onUnmounted(() => {
    stopAuthWatch()
    stopConfigWatch()
    stopRecentStateWatch()
    initialized = false
  })
}
