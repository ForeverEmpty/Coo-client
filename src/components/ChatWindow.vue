<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { ContentType } from '@/api/enum'
import { chatApi } from '@/api/chat'
import type { ChatHistoryMessage } from '@/api/types'
import ChatMainArea from './ChatMainArea.vue'
import GroupSidebar from './GroupSidebar.vue'
import EmptyState from './EmptyState.vue'
import { useChatStore } from '@/stores/chatStore'
import { useUserStore } from '@/stores/userStore'
import { wsManager } from '@/ws/manager'
import { randomID } from '@/utils/randomID'

const props = defineProps<{ chatId: string | null }>()

const chatStore = useChatStore()
const userStore = useUserStore()

const groupInfo = ref({
  notice: '',
  members: [] as { id: string; name: string; avatar: string; role: string }[],
})

const sessionMeta = computed(() => {
  if (!props.chatId) return null
  return chatStore.sessionMap[props.chatId] || null
})

const isGroup = computed(() => sessionMeta.value?.type === 2 || !!props.chatId?.startsWith('group_'))
const messages = computed(() => chatStore.getMessages(props.chatId))

const title = computed(() => {
  if (!sessionMeta.value) return ''
  return sessionMeta.value.title
})

const subTitle = computed(() => {
  if (!sessionMeta.value) return ''
  if (isGroup.value) {
    return sessionMeta.value.subTitle || `${groupInfo.value.members.length} online`
  }
  return sessionMeta.value.subTitle || 'online'
})

const myAvatar = computed(() => userStore.userInfo?.avatar || '')
const peerAvatar = computed(() => sessionMeta.value?.avatar || '')
const peerName = computed(() => sessionMeta.value?.title || '')

const historyCursorByChatId = ref<Record<string, string | null>>({})
const historyHasMoreByChatId = ref<Record<string, boolean>>({})
const historyLoadingByChatId = ref<Record<string, boolean>>({})
const historyInitializedByChatId = ref<Record<string, boolean>>({})

const historyLoading = computed(() => {
  if (!props.chatId) return false
  return !!historyLoadingByChatId.value[props.chatId]
})

const historyHasMore = computed(() => {
  if (!props.chatId) return false
  return !!historyHasMoreByChatId.value[props.chatId]
})

const sendPrivateMessage = async (chatId: string, content: string, sequence: string) => {
  const fromId = userStore.userInfo?.id
  if (!fromId) {
    throw new Error('user not logged in')
  }

  await wsManager.sendChat(
    {
      fromId,
      toId: chatId,
      chatType: 1,
      contentType: ContentType.TEXT,
      content,
      timestamp: Date.now(),
    },
    { requireAck: true, sequence },
  )
}

const handleSend = (text: string) => {
  const chatId = props.chatId
  const content = text.trim()
  if (!chatId || !content) return

  if (isGroup.value) {
    toast.info('Group realtime send is not available yet')
    return
  }

  const fromId = userStore.userInfo?.id
  if (!fromId) {
    toast.error('Please login before sending messages')
    return
  }

  const sequence = randomID()
  chatStore.appendOutgoingMessage(chatId, {
    localId: randomID(),
    sequence,
    fromId,
    toId: chatId,
    chatType: 1,
    contentType: ContentType.TEXT,
    content,
    timestamp: Date.now(),
  })

  void sendPrivateMessage(chatId, content, sequence).catch(() => {
    chatStore.markMessageFailedBySequence(sequence)
  })
}

const handleRetry = (localId: string) => {
  const chatId = props.chatId
  if (!chatId || isGroup.value) return

  const snapshot = chatStore.retryFailedMessage(chatId, localId)
  if (!snapshot) return

  const sequence = randomID()
  chatStore.bindMessageSequence(chatId, localId, sequence)

  void sendPrivateMessage(chatId, snapshot.content, sequence).catch(() => {
    chatStore.markMessageFailedBySequence(sequence)
  })
}

const mapHistoryMessage = (item: ChatHistoryMessage, currentUserId: string) => {
  const isOutgoing = item.fromId === currentUserId
  const isRecalled = item.status === 1

  return {
    localId: item.id || randomID(),
    sequence: item.id || undefined,
    fromId: item.fromId,
    toId: item.toId,
    chatType: item.chatType,
    contentType: item.contentType,
    content: isRecalled ? '[Message recalled]' : item.content || '',
    timestamp: Number(item.timestamp) || Date.now(),
    direction: isOutgoing ? ('out' as const) : ('in' as const),
    status: 'sent' as const,
  }
}

const loadPrivateHistory = async (chatId: string) => {
  const currentUserId = userStore.userInfo?.id
  if (!currentUserId) return
  if (historyLoadingByChatId.value[chatId]) return

  historyLoadingByChatId.value[chatId] = true
  try {
    const cursor = historyCursorByChatId.value[chatId] || undefined
    const res = await chatApi.getPrivateHistory({
      peerId: chatId,
      cursor,
      limit: 20,
    })
    const payload = res.data
    const list = [...(payload?.list || [])].reverse()
    const mapped = list.map((item) => mapHistoryMessage(item, currentUserId))

    chatStore.prependHistoryMessages(chatId, mapped)
    historyHasMoreByChatId.value[chatId] = !!payload?.hasMore
    historyCursorByChatId.value[chatId] = payload?.nextCursor || null
    historyInitializedByChatId.value[chatId] = true
  } catch {
    if (!historyInitializedByChatId.value[chatId]) {
      historyHasMoreByChatId.value[chatId] = false
    }
  } finally {
    historyLoadingByChatId.value[chatId] = false
  }
}

const handleLoadMoreHistory = () => {
  const chatId = props.chatId
  if (!chatId || isGroup.value) return
  if (!historyHasMoreByChatId.value[chatId]) return
  void loadPrivateHistory(chatId)
}

watch(
  () => props.chatId,
  (newId) => {
    if (!newId) return

    if (!isGroup.value && !historyInitializedByChatId.value[newId]) {
      void loadPrivateHistory(newId)
      return
    }

    if (!isGroup.value) return

    groupInfo.value = {
      notice: 'Group feature is under development. Preview mode only.',
      members: Array.from({ length: 20 }).map((_, i) => ({
        id: `${i}`,
        name: `Member ${i}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
        role: i === 0 ? 'owner' : 'member',
      })),
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="h-full w-full bg-background relative overflow-hidden flex items-center justify-center">
    <Transition name="fade" mode="out-in">
      <div v-if="chatId" key="chat" class="flex w-full h-full">
        <ChatMainArea
          :chat-id="chatId"
          :title="title"
          :sub-title="subTitle"
          :messages="messages"
          :is-group="isGroup"
          :my-avatar="myAvatar"
          :peer-avatar="peerAvatar"
          :peer-name="peerName"
          :history-loading="historyLoading"
          :history-has-more="historyHasMore"
          @send="handleSend"
          @retry="handleRetry"
          @load-more-history="handleLoadMoreHistory"
        />
        <GroupSidebar v-if="isGroup" :notice="groupInfo.notice" :members="groupInfo.members" />
      </div>

      <EmptyState v-else key="empty" />
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
