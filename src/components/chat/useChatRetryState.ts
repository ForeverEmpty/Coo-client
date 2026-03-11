import { ref } from 'vue'

export const useChatRetryState = () => {
  const retryFeedbackIds = ref<Set<string>>(new Set())
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const isRetryAnimating = (localId: string) => retryFeedbackIds.value.has(localId)

  const markRetryAnimating = (localId: string, durationMs = 900) => {
    const nextSet = new Set(retryFeedbackIds.value)
    nextSet.add(localId)
    retryFeedbackIds.value = nextSet

    const prevTimer = retryTimers.get(localId)
    if (prevTimer) {
      clearTimeout(prevTimer)
    }

    const timer = setTimeout(() => {
      const clearSet = new Set(retryFeedbackIds.value)
      clearSet.delete(localId)
      retryFeedbackIds.value = clearSet
      retryTimers.delete(localId)
    }, durationMs)

    retryTimers.set(localId, timer)
  }

  const clearRetryState = () => {
    retryTimers.forEach((timer) => clearTimeout(timer))
    retryTimers.clear()
    retryFeedbackIds.value = new Set()
  }

  return {
    retryFeedbackIds,
    isRetryAnimating,
    markRetryAnimating,
    clearRetryState,
  }
}
