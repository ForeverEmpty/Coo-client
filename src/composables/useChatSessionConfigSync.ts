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

  const stopAuthWatch = watch(
    () => [userStore.token, userStore.userInfo?.id] as const,
    async ([token, userId]) => {
      if (!token || !userId) {
        syncedUserId = null
        chatStore.resetSessionConfig()
        return
      }

      if (syncedUserId === userId) {
        return
      }

      hydrating = true
      try {
        const res = await socialApi.getChatSessionConfig()
        chatStore.applySessionConfig(res.data)
      } catch {
        chatStore.resetSessionConfig()
      } finally {
        hydrating = false
        syncedUserId = userId
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

  onUnmounted(() => {
    stopAuthWatch()
    stopConfigWatch()
    initialized = false
  })
}
