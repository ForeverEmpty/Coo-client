import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import type { ChatUiMessage } from '@/stores/chatStore'

interface UseChatScrollStateOptions {
  bottomThreshold: number
  maxBadgeCount: number
  bottomAnchor: Ref<HTMLElement | null>
  scrollAreaHostRef: Ref<HTMLElement | null>
  topLoadThreshold?: number
  canLoadMoreHistory?: () => boolean
  isHistoryLoading?: () => boolean
  onReachTopLoadMore?: () => void
}

export const useChatScrollState = (options: UseChatScrollStateOptions) => {
  const viewportEl = ref<HTMLElement | null>(null)
  const autoFollowLatest = ref(true)
  const unreadIncomingIds = ref<string[]>([])
  const visibleUnreadCount = ref(0)
  const messageElMap = ref(new Map<string, HTMLElement>())
  const topLoadThreshold = options.topLoadThreshold ?? 24

  let removeViewportScrollListener: (() => void) | null = null
  let topLoadLocked = false

  const resolveViewport = () => {
    const host = options.scrollAreaHostRef.value
    if (!host) return null
    return host.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null
  }

  const isNearBottom = () => {
    const viewport = viewportEl.value
    if (!viewport) return true
    const distance = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight)
    return distance <= options.bottomThreshold
  }

  const isNearTop = () => {
    const viewport = viewportEl.value
    if (!viewport) return true
    return viewport.scrollTop <= topLoadThreshold
  }

  const maybeLoadMoreAtTop = () => {
    if (!options.onReachTopLoadMore || !options.canLoadMoreHistory || !options.isHistoryLoading) {
      return
    }

    if (!isNearTop()) {
      topLoadLocked = false
      return
    }

    if (topLoadLocked) return
    if (!options.canLoadMoreHistory()) return
    if (options.isHistoryLoading()) return

    topLoadLocked = true
    options.onReachTopLoadMore()
  }

  const clearUnreadState = () => {
    unreadIncomingIds.value = []
    visibleUnreadCount.value = 0
  }

  const recalcUnreadBubbleCount = () => {
    const viewport = viewportEl.value
    if (!viewport || unreadIncomingIds.value.length === 0) {
      visibleUnreadCount.value = 0
      return
    }

    const viewportBottom = viewport.getBoundingClientRect().bottom
    const remaining: string[] = []

    unreadIncomingIds.value.forEach((messageId) => {
      const el = messageElMap.value.get(messageId)
      if (!el) return

      const rect = el.getBoundingClientRect()
      if (rect.top < viewportBottom) return
      remaining.push(messageId)
    })

    unreadIncomingIds.value = remaining
    visibleUnreadCount.value = remaining.length
  }

  const scrollToBottom = async (behavior: ScrollBehavior = 'smooth') => {
    await nextTick()
    if (!options.bottomAnchor.value) return
    options.bottomAnchor.value.scrollIntoView({ block: 'end', behavior })
  }

  const scrollToBottomSettled = (behavior: ScrollBehavior = 'smooth') => {
    void scrollToBottom(behavior)
    requestAnimationFrame(() => {
      void scrollToBottom('auto')
    })
    setTimeout(() => {
      void scrollToBottom('auto')
    }, 80)
    setTimeout(() => {
      void scrollToBottom('auto')
    }, 220)
  }

  const bindViewport = () => {
    const viewport = resolveViewport()
    if (!viewport || viewportEl.value === viewport) {
      return
    }

    if (removeViewportScrollListener) {
      removeViewportScrollListener()
      removeViewportScrollListener = null
    }

    viewportEl.value = viewport
    const onScroll = () => {
      maybeLoadMoreAtTop()

      if (isNearBottom()) {
        autoFollowLatest.value = true
        clearUnreadState()
        return
      }

      autoFollowLatest.value = false
      if (unreadIncomingIds.value.length > 0) {
        recalcUnreadBubbleCount()
      }
    }

    viewport.addEventListener('scroll', onScroll, { passive: true })
    removeViewportScrollListener = () => {
      viewport.removeEventListener('scroll', onScroll)
    }
  }

  const setMessageRef = (localId: string, el: Element | null) => {
    if (el instanceof HTMLElement) {
      messageElMap.value.set(localId, el)
      return
    }
    messageElMap.value.delete(localId)
  }

  const handleJumpFirstUnread = async () => {
    if (unreadIncomingIds.value.length === 0) return

    await nextTick()
    const firstUnreadId = unreadIncomingIds.value[0]
    const target = firstUnreadId ? messageElMap.value.get(firstUnreadId) : null

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          recalcUnreadBubbleCount()
        })
      })
      return
    }

    recalcUnreadBubbleCount()
  }

  const badgeText = () =>
    visibleUnreadCount.value > options.maxBadgeCount
      ? `${options.maxBadgeCount}+`
      : String(visibleUnreadCount.value)

  const handleMessagesIdsChanged = async (
    newIds: string[],
    oldIds: string[] | undefined,
    messages: ChatUiMessage[],
  ) => {
    const oldList = oldIds || []
    const newLen = newIds.length
    const oldLen = oldList.length
    const beforeViewport = viewportEl.value
    const beforeScrollTop = beforeViewport?.scrollTop ?? 0
    const beforeScrollHeight = beforeViewport?.scrollHeight ?? 0

    if (newLen === 0) {
      clearUnreadState()
      return
    }

    const addedCount = newLen - oldLen
    if (addedCount <= 0) return

    if (oldLen === 0) {
      if (autoFollowLatest.value) {
        scrollToBottomSettled('smooth')
      }
      return
    }

    const isPrepend = oldList.every((id, index) => newIds[index + addedCount] === id)
    if (isPrepend) {
      await nextTick()
      const viewport = viewportEl.value
      if (!viewport || !beforeViewport || viewport !== beforeViewport) return
      const deltaHeight = viewport.scrollHeight - beforeScrollHeight
      if (deltaHeight <= 0) return
      viewport.scrollTop = beforeScrollTop + deltaHeight
      if (viewport.scrollTop > topLoadThreshold) {
        topLoadLocked = false
      }
      return
    }

    const isAppend = oldList.every((id, index) => newIds[index] === id)
    if (!isAppend) {
      if (autoFollowLatest.value) {
        scrollToBottomSettled('smooth')
      }
      return
    }

    const appendedIds = newIds.slice(oldLen)
    const appendedMessages = appendedIds
      .map((id) => messages.find((item) => item.localId === id))
      .filter((item): item is ChatUiMessage => !!item)
    const hasOutgoing = appendedMessages.some((item) => item.direction === 'out')
    const appendedIncomingIds = appendedMessages
      .filter((item) => item.direction === 'in')
      .map((item) => item.localId)

    // Always follow own newly-sent messages (text/image/file), especially for burst sends.
    if (hasOutgoing) {
      autoFollowLatest.value = true
      scrollToBottomSettled('smooth')
      return
    }

    if (autoFollowLatest.value) {
      scrollToBottomSettled('smooth')
      return
    }

    if (appendedIncomingIds.length === 0) return

    appendedIncomingIds.forEach((id) => {
      if (!unreadIncomingIds.value.includes(id)) {
        unreadIncomingIds.value.push(id)
      }
    })

    await nextTick()
    recalcUnreadBubbleCount()
  }

  const resetForChatSwitch = async () => {
    autoFollowLatest.value = true
    topLoadLocked = false
    clearUnreadState()
    messageElMap.value.clear()
    await nextTick()
    bindViewport()
    scrollToBottomSettled('auto')
  }

  const cleanupScrollState = () => {
    if (removeViewportScrollListener) {
      removeViewportScrollListener()
      removeViewportScrollListener = null
    }
    messageElMap.value.clear()
    topLoadLocked = false
    clearUnreadState()
  }

  return {
    autoFollowLatest,
    visibleUnreadCount,
    bindViewport,
    badgeText,
    setMessageRef,
    scrollToBottom,
    scrollToBottomSettled,
    handleJumpFirstUnread,
    handleMessagesIdsChanged,
    resetForChatSwitch,
    cleanupScrollState,
  }
}
