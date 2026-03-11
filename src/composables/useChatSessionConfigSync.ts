import { useDebounceFn } from '@vueuse/core'
import { onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  const route = useRoute()
  const router = useRouter()

  let hydrating = false
  let syncedUserId: string | null = null
  const routerReady = ref(false)
  let validatedToken: string | null = null

  const isAuthRoute = () => route.path.startsWith('/auth')
  void router.isReady().then(() => {
    routerReady.value = true
  })

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
    if (isAuthRoute()) return
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
    if (isAuthRoute()) return
    const token = userStore.token
    const userId = userStore.userInfo?.id
    if (!token || !userId) return
    if (hydrating || syncedUserId !== userId) return
    void chatStore.persistRecentState(userId)
  }, 150)

  const stopAuthWatch = watch(
    () => [userStore.token, userStore.userInfo?.id, route.path, routerReady.value] as const,
    async ([token, userId, path, ready]) => {
      if (!ready) return
      if (!token || !userId || path.startsWith('/auth')) {
        if (!token) {
          validatedToken = null
        }
        syncedUserId = null
        chatStore.resetRuntimeState()
        return
      }

      if (syncedUserId === userId) {
        return
      }
      if (hydrating) {
        return
      }
      hydrating = true

      // Validate auth at most once per token to avoid repeated auth/me calls.
      if (token !== validatedToken) {
        await userStore.fetchUserInfo()
        const latestToken = userStore.token
        const latestUserId = userStore.userInfo?.id
        validatedToken = latestToken || null
        if (!latestToken || !latestUserId || isAuthRoute()) {
          hydrating = false
          syncedUserId = null
          chatStore.resetRuntimeState()
          return
        }

        token = latestToken
        userId = latestUserId
        if (syncedUserId === userId) {
          hydrating = false
          return
        }
      }

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
    () => [chatStore.pinnedChatIds, chatStore.hiddenRecentChatIds, chatStore.mutedChatIds] as const,
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
