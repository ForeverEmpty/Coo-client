import { onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { useRouter } from 'vue-router'

import { requestObserver } from '@/utils/requestObserver'
import { usePlatform } from './usePlatform'

export function useRequestManager() {
  const router = useRouter()
  const { p, isElectron } = usePlatform()

  const unSubError = requestObserver.onError((payload) => {
    toast.error(payload.message || '请求错误')

    if (isElectron) {
      window.electronAPI.log.error(`API Error: ${payload.message}`, payload.config?.url)
    }
  })

  const unSubAuth = requestObserver.onUnauthorized(() => {
    localStorage.removeItem('coo_token')

    if (isElectron) {
      window.electronAPI.log.warn('User unauthorized, token removed')
      p.send('re-login')
      return
    }

    router.push('/login')
  })

  const unSubTimeout = requestObserver.onTimeout(() => {
    toast.warning('Timeout, please check server status')

    if (isElectron) {
      window.electronAPI.log.error('Network Timeout on desktop')
    }
  })

  onUnmounted(() => {
    unSubError()
    unSubAuth()
    unSubTimeout()
  })
}
