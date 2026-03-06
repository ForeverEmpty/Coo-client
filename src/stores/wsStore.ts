import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { WSStateSnapshot, WSStatus } from '@/ws/types'

export const useWsStore = defineStore('ws', () => {
  const status = ref<WSStatus>('idle')
  const retryCount = ref(0)
  const lastPingAt = ref<number | null>(null)
  const lastPongAt = ref<number | null>(null)
  const lastError = ref<string | null>(null)

  const connected = computed(() => status.value === 'connected')

  const patch = (snapshot: WSStateSnapshot) => {
    status.value = snapshot.status
    retryCount.value = snapshot.retryCount
    lastPingAt.value = snapshot.lastPingAt
    lastPongAt.value = snapshot.lastPongAt
    lastError.value = snapshot.lastError
  }

  const reset = () => {
    status.value = 'idle'
    retryCount.value = 0
    lastPingAt.value = null
    lastPongAt.value = null
    lastError.value = null
  }

  return {
    status,
    connected,
    retryCount,
    lastPingAt,
    lastPongAt,
    lastError,
    patch,
    reset,
  }
})
