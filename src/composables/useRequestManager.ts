import { onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { useRouter } from 'vue-router'

import { requestObserver } from '@/utils/requestObserver'
import { useUserStore } from '@/stores/userStore'
import { usePlatform } from './usePlatform'

export function useRequestManager() {
  const router = useRouter()
  const userStore = useUserStore()
  const { p, isElectron } = usePlatform()

  const unSubError = requestObserver.onError((payload) => {
    if (payload.code === 401) return

    toast.error(payload.message || 'Request failed')

    if (isElectron) {
      window.electronAPI.log.error(`API Error: ${payload.message}`, payload.config?.url)
    }
  })

  const unSubAuth = requestObserver.onUnauthorized(() => {
    userStore.logout()

    if (isElectron) {
      window.electronAPI.log.warn('User unauthorized, token removed')
      p.send('re-login')
      return
    }

    router.push('/auth/login')
  })

  const unSubTimeout = requestObserver.onTimeout(() => {
    toast.warning('Timeout, please check server status')

    if (isElectron) {
      window.electronAPI.log.error('Network timeout on desktop')
    }
  })

  onUnmounted(() => {
    unSubError()
    unSubAuth()
    unSubTimeout()
  })
}
