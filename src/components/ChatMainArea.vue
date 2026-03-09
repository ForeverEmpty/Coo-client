<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertCircle,
  Image,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Send,
  Smile,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Resizer } from '@/components/common/resizer'
import { formatLocalDateTime } from '@/utils/dateTime'
import type { ChatUiMessage } from '@/stores/chatStore'

const props = defineProps<{
  chatId: string
  title: string
  subTitle: string
  messages: ChatUiMessage[]
  isGroup?: boolean
  myAvatar?: string
  peerAvatar?: string
  peerName?: string
  historyLoading?: boolean
  historyHasMore?: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
  retry: [localId: string]
  loadMoreHistory: []
}>()

const router = useRouter()
const BOTTOM_THRESHOLD = 24
const MAX_BADGE_COUNT = 99

const footerHeight = ref(200)
const inputText = ref('')
const bottomAnchor = ref<HTMLElement | null>(null)
const scrollAreaHostRef = ref<HTMLElement | null>(null)
const viewportEl = ref<HTMLElement | null>(null)
const autoFollowLatest = ref(true)
const unreadIncomingIds = ref<string[]>([])
const visibleUnreadCount = ref(0)
const messageElMap = ref(new Map<string, HTMLElement>())
const retryFeedbackIds = ref<Set<string>>(new Set())
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
let removeViewportScrollListener: (() => void) | null = null

const handleAvatarClick = (userId: string) => {
  if (!userId) return
  router.push(`/profile/${userId}`)
}

const handleSend = () => {
  const text = inputText.value.trim()
  if (!text) return
  emit('send', text)
  inputText.value = ''
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

const formatMessageTime = (timestamp: number) => {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return ''
  return formatLocalDateTime(new Date(ts), 'zh-CN')
}

const isRetryAnimating = (localId: string) => retryFeedbackIds.value.has(localId)

const handleRetryClick = (localId: string) => {
  emit('retry', localId)

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
  }, 900)
  retryTimers.set(localId, timer)
}

const setMessageRef = (localId: string, el: Element | null) => {
  if (el instanceof HTMLElement) {
    messageElMap.value.set(localId, el)
    return
  }
  messageElMap.value.delete(localId)
}

const resolveViewport = () => {
  const host = scrollAreaHostRef.value
  if (!host) return null
  return host.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null
}

const isNearBottom = () => {
  const viewport = viewportEl.value
  if (!viewport) return true
  const distance = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight)
  return distance <= BOTTOM_THRESHOLD
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
    if (rect.top < viewportBottom) {
      return
    }
    remaining.push(messageId)
  })

  unreadIncomingIds.value = remaining
  visibleUnreadCount.value = remaining.length
}

const scrollToBottom = async (behavior: ScrollBehavior = 'auto') => {
  await nextTick()
  if (!bottomAnchor.value) return
  bottomAnchor.value.scrollIntoView({ block: 'end', behavior })
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
  visibleUnreadCount.value > MAX_BADGE_COUNT
    ? `${MAX_BADGE_COUNT}+`
    : String(visibleUnreadCount.value)

watch(
  () => props.chatId,
  async () => {
    autoFollowLatest.value = true
    clearUnreadState()
    messageElMap.value.clear()
    await nextTick()
    bindViewport()
    await scrollToBottom()
  },
  { immediate: true },
)

watch(
  () => props.messages.map((item) => item.localId),
  async (newIds, oldIds) => {
    const oldList = oldIds || []
    const newLen = newIds.length
    const oldLen = oldList.length

    if (newLen === 0) {
      clearUnreadState()
      return
    }

    const addedCount = newLen - oldLen
    if (addedCount <= 0) {
      return
    }

    if (oldLen === 0) {
      if (autoFollowLatest.value) {
        await scrollToBottom()
      }
      return
    }

    const isPrepend = oldList.every((id, index) => newIds[index + addedCount] === id)
    if (isPrepend) {
      return
    }

    const isAppend = oldList.every((id, index) => newIds[index] === id)
    if (!isAppend) {
      if (autoFollowLatest.value) {
        await scrollToBottom()
      }
      return
    }

    const appendedIds = newIds.slice(oldLen)
    const appendedIncomingIds = appendedIds.filter((id) => {
      const msg = props.messages.find((item) => item.localId === id)
      return msg?.direction === 'in'
    })

    if (autoFollowLatest.value) {
      await scrollToBottom()
      return
    }

    if (appendedIncomingIds.length === 0) {
      return
    }

    appendedIncomingIds.forEach((id) => {
      if (!unreadIncomingIds.value.includes(id)) {
        unreadIncomingIds.value.push(id)
      }
    })

    await nextTick()
    recalcUnreadBubbleCount()
  },
)

onMounted(async () => {
  await nextTick()
  bindViewport()
  await scrollToBottom()
})

onBeforeUnmount(() => {
  if (removeViewportScrollListener) {
    removeViewportScrollListener()
    removeViewportScrollListener = null
  }

  messageElMap.value.clear()
  clearUnreadState()
  retryTimers.forEach((timer) => clearTimeout(timer))
  retryTimers.clear()
})
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0 h-full">
    <header
      class="h-16 border-b flex items-center px-6 justify-between shrink-0 bg-background/80 backdrop-blur-md z-10"
    >
      <div>
        <div class="font-bold text-base flex items-center gap-2">
          {{ title }}
          <span v-if="isGroup" class="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
            Group
          </span>
        </div>
        <div class="text-[10px] text-muted-foreground flex items-center gap-1">
          <span v-if="!isGroup" class="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
          {{ subTitle }}
        </div>
      </div>
      <Button variant="ghost" size="icon" class="rounded-full">
        <MoreHorizontal class="w-5 h-5" />
      </Button>
    </header>

    <div ref="scrollAreaHostRef" class="relative flex-1 min-h-0">
      <ScrollArea class="h-full px-6 pt-6 min-h-0">
        <div class="space-y-6">
          <div v-if="historyHasMore || historyLoading" class="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              :disabled="historyLoading"
              @click="emit('loadMoreHistory')"
            >
              {{ historyLoading ? 'Loading...' : 'Load more messages' }}
            </Button>
          </div>

          <div
            v-for="msg in messages"
            :key="msg.localId"
            :ref="(el) => setMessageRef(msg.localId, el as Element | null)"
            class="flex gap-3 max-w-[85%]"
            :class="msg.direction === 'out' ? 'ml-auto flex-row-reverse' : ''"
          >
            <Avatar
              class="h-9 w-9 mt-1 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              @click="handleAvatarClick(msg.fromId)"
            >
              <AvatarImage :src="msg.direction === 'out' ? myAvatar || '' : peerAvatar || ''" />
              <AvatarFallback>
                {{ msg.direction === 'out' ? 'Me' : peerName?.[0] || 'U' }}
              </AvatarFallback>
            </Avatar>

            <div
              :class="msg.direction === 'out' ? 'items-end' : 'items-start'"
              class="flex flex-col min-w-0"
            >
              <span
                v-if="isGroup && msg.direction !== 'out'"
                class="text-[10px] text-muted-foreground mb-1 ml-1"
              >
                {{ msg.fromId }}
              </span>

              <div
                class="px-4 py-2.5 text-sm shadow-sm leading-relaxed whitespace-pre-wrap warp-break-words"
                :class="
                  msg.direction === 'out'
                    ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-none'
                    : 'bg-muted/80 text-foreground rounded-2xl rounded-tl-none'
                "
              >
                {{ msg.content }}
              </div>

              <div class="mt-1 mx-1 text-[10px] text-muted-foreground flex items-center gap-2">
                <span>{{ formatMessageTime(msg.timestamp) }}</span>
                <Loader2
                  v-if="msg.direction === 'out' && msg.status === 'sending'"
                  class="h-3.5 w-3.5 animate-spin text-muted-foreground/80"
                  title="Sending..."
                />
                <button
                  v-if="msg.direction === 'out' && msg.status === 'failed'"
                  class="relative text-red-500 hover:text-red-600 transition-colors"
                  :title="
                    isRetryAnimating(msg.localId) ? 'Retrying...' : 'Send failed, click to retry'
                  "
                  @click="handleRetryClick(msg.localId)"
                >
                  <span
                    v-if="isRetryAnimating(msg.localId)"
                    class="pointer-events-none absolute inset-0 rounded-full retry-ring"
                  />
                  <AlertCircle
                    class="h-3.5 w-3.5"
                    :class="isRetryAnimating(msg.localId) ? 'retry-icon' : ''"
                  />
                </button>
              </div>
            </div>
          </div>

          <div ref="bottomAnchor" />
        </div>
      </ScrollArea>

      <button
        v-if="visibleUnreadCount > 0"
        class="absolute right-4 bottom-4 z-20 rounded-full bg-primary text-primary-foreground shadow-md px-3 py-1.5 text-xs hover:bg-primary/90 transition-colors"
        @click="handleJumpFirstUnread"
      >
        {{ badgeText() }} 条新消息
      </button>
    </div>

    <Resizer v-model="footerHeight" direction="vertical" side="top" :min="120" :max="500" />

    <footer
      class="border-t bg-background flex flex-col shrink-0"
      :style="{ height: `${footerHeight}px` }"
    >
      <div class="flex items-center gap-1 px-2 pt-2">
        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground">
          <Smile class="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground">
          <Image class="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground">
          <Paperclip class="h-5 w-5" />
        </Button>
      </div>
      <div class="flex-1 flex gap-2 p-2 min-h-0">
        <Textarea
          v-model="inputText"
          placeholder="Type a message..."
          class="flex-1 bg-muted/30 border-none resize-none focus-visible:ring-0 text-sm custom-scrollbar"
          @keydown="handleKeydown"
        />
        <div class="flex flex-col justify-end pb-1 pr-1">
          <Button size="icon" class="h-10 w-10 rounded-full shadow-md" @click="handleSend">
            <Send class="h-5 w-5" />
          </Button>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: transparent;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.2);
  border-radius: 4px;
}

.retry-icon {
  animation: retryIcon 0.45s ease-in-out;
}

.retry-ring {
  animation: retryRing 0.6s ease-out;
}

@keyframes retryIcon {
  0% {
    transform: scale(1) rotate(0deg);
  }
  35% {
    transform: scale(1.2) rotate(-12deg);
  }
  70% {
    transform: scale(1.05) rotate(8deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

@keyframes retryRing {
  0% {
    transform: scale(0.7);
    opacity: 0.35;
    box-shadow: 0 0 0 0 hsl(var(--destructive) / 0.35);
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
    box-shadow: 0 0 0 8px hsl(var(--destructive) / 0);
  }
}
</style>
