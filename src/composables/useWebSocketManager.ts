import { onUnmounted, watch } from 'vue'
import { requestObserver } from '@/utils/requestObserver'
import { useUserStore } from '@/stores/userStore'
import { useWsStore } from '@/stores/wsStore'
import { wsManager } from '@/ws/manager'

let initialized = false

export function useWebSocketManager() {
  if (initialized) {
    return
  }
  initialized = true

  const userStore = useUserStore()
  const wsStore = useWsStore()

  const unbindState = wsManager.bindState((snapshot) => {
    wsStore.patch(snapshot)
  })

  const stopWatchToken = watch(
    () => userStore.token,
    (token, previous) => {
      wsManager.setToken(token || '')

      if (!token) {
        wsManager.disconnect('token cleared')
        wsStore.reset()
        return
      }

      const force = !!previous && previous !== token
      wsManager.connect(force)
    },
    { immediate: true },
  )

  const unsubscribeUnauthorized = requestObserver.onUnauthorized(() => {
    wsManager.setToken('')
    wsManager.disconnect('unauthorized')
    wsStore.reset()
  })

  onUnmounted(() => {
    stopWatchToken()
    unsubscribeUnauthorized()
    unbindState()
    wsManager.disconnect('app unmounted')
    initialized = false
  })
}
