<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ContentType } from '@/api/enum'
import { chatApi } from '@/api/chat'
import { fileApi } from '@/api/file'
import { socialApi } from '@/api/social'
import type { ChatHistoryMessage, ChatMessage, GroupInfo, GroupMember } from '@/api/types'
import ChatMainArea from './ChatMainArea.vue'
import GroupSidebar from './GroupSidebar.vue'
import EmptyState from './EmptyState.vue'
import { useChatStore } from '@/stores/chatStore'
import { useUserStore } from '@/stores/userStore'
import type {
  ComposerAttachment,
  ComposerPayload,
  ComposerSendResult,
  ForwardActionPayload,
} from '@/types/chatComposer'
import { wsManager } from '@/ws/manager'
import { randomID } from '@/utils/randomID'
import { onGroupUpdated } from '@/utils/groupSync'

const props = defineProps<{ chatId: string | null }>()

const chatStore = useChatStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const groupInfo = ref<GroupInfo | null>(null)
const groupMembers = ref<GroupMember[]>([])

const sessionMeta = computed(() => {
  if (!props.chatId) return null
  return chatStore.sessionMap[props.chatId] || null
})

const isGroup = computed(() => sessionMeta.value?.type === 2 || !!props.chatId?.startsWith('group_'))
const messages = computed(() => chatStore.getMessages(props.chatId))
const currentUserId = computed(() => String(userStore.userInfo?.id || ''))

const title = computed(() => {
  if (isGroup.value) {
    return sessionMeta.value?.title || groupInfo.value?.remark || groupInfo.value?.name || ''
  }
  return sessionMeta.value?.title || ''
})

const subTitle = computed(() => {
  if (!sessionMeta.value) return ''
  if (isGroup.value) {
    if (sessionMeta.value?.subTitle) return sessionMeta.value.subTitle
    const memberCount = groupInfo.value?.memberCount || groupMembers.value.length || 0
    const myTitle = groupInfo.value?.myTitleName || '群成员'
    return `${memberCount} 人 · ${myTitle}`
  }
  return sessionMeta.value.subTitle || '在线'
})

const myAvatar = computed(() => userStore.userInfo?.avatar || '')
const peerAvatar = computed(() => sessionMeta.value?.avatar || '')
const peerName = computed(() => sessionMeta.value?.title || '')
const currentUserGroupRole = computed(() => groupInfo.value?.myRole)
const groupMemberMap = computed<Record<string, { name: string; avatar?: string; role?: number }>>(() => {
  const map: Record<string, { name: string; avatar?: string; role?: number }> = {}
  groupMembers.value.forEach((member) => {
    map[String(member.userId)] = {
      name: member.nicknameInGroup || member.displayName || member.nickname || member.username || String(member.userId),
      avatar: member.avatar || '',
      role: member.role,
    }
  })
  return map
})

const historyCursorByChatId = ref<Record<string, string | null>>({})
const historyHasMoreByChatId = ref<Record<string, boolean>>({})
const historyLoadingByChatId = ref<Record<string, boolean>>({})
const historyInitializedByChatId = ref<Record<string, boolean>>({})
const sending = ref(false)
const pendingRetryFileByLocalId = new Map<string, ComposerAttachment>()
const RECALL_WINDOW_MS = 2 * 60 * 1000
type GroupSidebarTab = 'members' | 'images' | 'files' | 'manage'
const routeSidebarTab = ref<GroupSidebarTab | undefined>()
let offGroupUpdated: (() => void) | null = null

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message || ''
  }
  if (typeof error === 'string') {
    return error
  }
  return ''
}

const resolveRecallErrorText = (error: unknown, groupChat: boolean) => {
  const message = getErrorMessage(error).trim()
  if (!message) {
    return '撤回失败，请稍后重试'
  }

  if (message.includes('No permission to recall this message')) {
    return groupChat ? '仅群主或超管可撤回他人消息' : '只能撤回自己发送的消息'
  }
  if (message.includes('Recall time window exceeded')) {
    return groupChat ? '发送超过 2 分钟的消息不可撤回（群主/超管可撤回他人消息）' : '已超过 2 分钟撤回时限'
  }
  if (message.includes('Message not found')) {
    return '消息不存在，可能已被删除'
  }
  if (message.includes('Only sender can recall this message')) {
    return '只能撤回自己发送的消息'
  }
  if (message.includes('Only group chat messages can be recalled')) {
    return '仅支持撤回群聊消息'
  }
  if (message.includes('Only private chat messages can be recalled')) {
    return '仅支持撤回私聊消息'
  }
  return message
}

const historyLoading = computed(() => {
  if (!props.chatId) return false
  return !!historyLoadingByChatId.value[props.chatId]
})

const historyHasMore = computed(() => {
  if (!props.chatId) return false
  return !!historyHasMoreByChatId.value[props.chatId]
})

const extractGroupId = (chatId: string) => (chatId.startsWith('group_') ? chatId.slice(6) : chatId)
const resolveGroupSidebarTab = (raw: unknown): GroupSidebarTab | undefined => {
  const value = String(raw || '').trim().toLowerCase()
  if (value === 'members' || value === 'images' || value === 'files' || value === 'manage') {
    return value
  }
  return undefined
}

const consumeGroupSidebarIntent = () => {
  if (!props.chatId || !isGroup.value) {
    routeSidebarTab.value = undefined
    return
  }
  const tab = resolveGroupSidebarTab(route.query.sidebarTab)
  if (!tab) {
    routeSidebarTab.value = undefined
    return
  }

  const targetGroupId = String(route.query.groupId || '').trim()
  const currentGroupId = extractGroupId(props.chatId)
  if (targetGroupId && targetGroupId !== currentGroupId) {
    return
  }

  routeSidebarTab.value = tab

  const nextQuery = { ...route.query }
  delete nextQuery.groupId
  delete nextQuery.sidebarTab
  void router.replace({ query: nextQuery })
}

const initLocalHistoryCursor = (chatId: string) => {
  if (!chatStore.isLocalMessageCacheEnabled) {
    return false
  }
  if (!chatStore.hasCachedMessages(chatId)) {
    return false
  }

  const oldest = chatStore.getCachedOldestTimestamp(chatId)
  if (oldest === null || oldest === undefined) {
    return false
  }

  historyCursorByChatId.value[chatId] = String(oldest)
  historyHasMoreByChatId.value[chatId] = true
  historyInitializedByChatId.value[chatId] = true
  return true
}

const sendRealtimeMessage = async (
  targetId: string,
  chatType: 1 | 2,
  payload: Omit<ChatMessage, 'fromId' | 'toId' | 'chatType' | 'timestamp'>,
  sequence: string,
) => {
  const fromId = userStore.userInfo?.id
  if (!fromId) {
    throw new Error('user not logged in')
  }

  await wsManager.sendChat(
    {
      fromId,
      toId: targetId,
      chatType,
      contentType: payload.contentType,
      content: payload.content,
      url: payload.url,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      replyTo: payload.replyTo,
      timestamp: Date.now(),
    },
    { requireAck: true, sequence },
  )
}

const uploadAndSendAttachment = async (
  targetId: string,
  chatType: 1 | 2,
  localId: string,
  attachment: ComposerAttachment,
  replyTo?: ChatMessage['replyTo'],
) => {
  let sequence = ''
  const contentType = attachment.type === 'image' ? ContentType.IMAGE : ContentType.FILE
  const fallbackContent = attachment.type === 'image' ? '[图片]' : attachment.file.name

  try {
    const uploaded = await fileApi.upload(attachment.file)
    const url = uploaded.data
    if (!url) {
      throw new Error('empty upload url')
    }

    sequence = randomID()
    chatStore.patchMessage(props.chatId!, localId, {
      sequence,
      url,
      fileName: attachment.file.name,
      fileSize: attachment.file.size,
      content: fallbackContent,
      status: 'sending',
    })

    await sendRealtimeMessage(
      targetId,
      chatType,
      {
        contentType,
        content: fallbackContent,
        url,
        fileName: attachment.file.name,
        fileSize: attachment.file.size,
        replyTo,
      },
      sequence,
    )

    pendingRetryFileByLocalId.delete(localId)
    return true
  } catch {
    if (sequence) {
      chatStore.markMessageFailedBySequence(sequence)
    } else if (props.chatId) {
      chatStore.markMessageFailedByLocalId(props.chatId, localId)
    }
    throw new Error('attachment send failed')
  }
}

const handleSend = async (
  payload: ComposerPayload,
  onResult?: (result: ComposerSendResult) => void,
) => {
  const chatId = props.chatId
  if (!chatId) return

  const content = payload.text.trim()
  const attachments = payload.attachments || []
  const replyTo = payload.replyTo
  if (!content && attachments.length === 0) {
    onResult?.({ clearText: false, succeededAttachmentIds: [] })
    return
  }

  if (sending.value) {
    onResult?.({ clearText: false, succeededAttachmentIds: [] })
    return
  }

  const fromId = userStore.userInfo?.id
  if (!fromId) {
    toast.error('请先登录后再发送消息')
    onResult?.({ clearText: false, succeededAttachmentIds: [] })
    return
  }

  const targetId = isGroup.value ? extractGroupId(chatId) : chatId
  const chatType: 1 | 2 = isGroup.value ? 2 : 1

  sending.value = true
  const succeededAttachmentIds: string[] = []
  let clearText = false

  try {
    if (content) {
      clearText = true
      const sequence = randomID()
      chatStore.appendOutgoingMessage(chatId, {
        localId: randomID(),
        sequence,
        fromId,
        toId: targetId,
        chatType,
        contentType: ContentType.TEXT,
        content,
        replyTo,
        timestamp: Date.now(),
      })

      try {
        await sendRealtimeMessage(
          targetId,
          chatType,
          {
            contentType: ContentType.TEXT,
            content,
            replyTo,
          },
          sequence,
        )
      } catch {
        chatStore.markMessageFailedBySequence(sequence)
      }
    }

    for (const attachment of attachments) {
      const localId = randomID()
      const contentType = attachment.type === 'image' ? ContentType.IMAGE : ContentType.FILE
      const fallbackContent = attachment.type === 'image' ? '[图片]' : attachment.file.name

      chatStore.appendOutgoingMessage(chatId, {
        localId,
        fromId,
        toId: targetId,
        chatType,
        contentType,
        content: fallbackContent,
        url: attachment.resolvedUrl,
        fileName: attachment.file.name,
        fileSize: attachment.file.size,
        replyTo,
        timestamp: Date.now(),
      })

      try {
        if (attachment.type === 'image' && attachment.resolvedUrl) {
          const sequence = randomID()
          chatStore.bindMessageSequence(chatId, localId, sequence)
          await sendRealtimeMessage(
            targetId,
            chatType,
            {
              contentType: ContentType.IMAGE,
              content: fallbackContent,
              url: attachment.resolvedUrl,
              fileName: attachment.file.name,
              fileSize: attachment.file.size,
              replyTo,
            },
            sequence,
          )
        } else {
          pendingRetryFileByLocalId.set(localId, attachment)
          await uploadAndSendAttachment(targetId, chatType, localId, attachment, replyTo)
        }
        succeededAttachmentIds.push(attachment.id)
      } catch {
        // keep failed bubble
      }
    }
  } finally {
    sending.value = false
    onResult?.({ clearText, succeededAttachmentIds })
  }
}

const handleRetry = (localId: string) => {
  const chatId = props.chatId
  if (!chatId) return

  const snapshot = chatStore.retryFailedMessage(chatId, localId)
  if (!snapshot) return

  const targetId = isGroup.value ? extractGroupId(chatId) : chatId
  const chatType: 1 | 2 = isGroup.value ? 2 : 1
  const retryAsText = snapshot.contentType === ContentType.TEXT

  if (retryAsText) {
    const sequence = randomID()
    chatStore.bindMessageSequence(chatId, localId, sequence)

    void sendRealtimeMessage(
      targetId,
      chatType,
      {
        contentType: ContentType.TEXT,
        content: snapshot.content,
        replyTo: snapshot.replyTo,
      },
      sequence,
    ).catch(() => {
      chatStore.markMessageFailedBySequence(sequence)
    })
    return
  }

  if (snapshot.url) {
    const sequence = randomID()
    chatStore.bindMessageSequence(chatId, localId, sequence)

    void sendRealtimeMessage(
      targetId,
      chatType,
      {
        contentType: snapshot.contentType,
        content: snapshot.content,
        url: snapshot.url,
        fileName: snapshot.fileName,
        fileSize: snapshot.fileSize,
        replyTo: snapshot.replyTo,
      },
      sequence,
    ).catch(() => {
      chatStore.markMessageFailedBySequence(sequence)
    })
    return
  }

  const attachment = pendingRetryFileByLocalId.get(localId)
  if (!attachment) {
    chatStore.markMessageFailedByLocalId(chatId, localId)
    toast.error('找不到待重发的附件')
    return
  }

  void uploadAndSendAttachment(targetId, chatType, localId, attachment, snapshot.replyTo).catch(() => {
    // store already updated
  })
}

const mapHistoryMessage = (item: ChatHistoryMessage, currentUserIdValue: string) => {
  const isOutgoing = item.fromId === currentUserIdValue
  const isRecalled = item.status === 1

  return {
    localId: item.id || randomID(),
    sequence: item.id || undefined,
    fromId: item.fromId,
    toId: item.toId,
    chatType: item.chatType,
    contentType: item.contentType,
    content: isRecalled ? '[已撤回]' : item.content || '',
    url: item.url || '',
    fileName: item.fileName || '',
    fileSize: item.fileSize,
    timestamp: Number(item.timestamp) || Date.now(),
    direction: isOutgoing ? ('out' as const) : ('in' as const),
    status: isRecalled ? ('recalled' as const) : ('sent' as const),
    replyTo: item.replyTo,
  }
}

const handleDeleteLocal = (localIds: string[]) => {
  const chatId = props.chatId
  if (!chatId || localIds.length === 0) return
  chatStore.removeLocalMessages(chatId, localIds)
}

const handleRecall = async (localId: string) => {
  const chatId = props.chatId
  if (!chatId) return

  const message = chatStore.getMessageByLocalId(chatId, localId)
  if (!message) return
  if (message.status === 'recalled') {
    toast.info('消息已经撤回')
    return
  }
  if (message.status !== 'sent') {
    toast.error('消息当前状态不支持撤回')
    return
  }
  if (!message.sequence) {
    toast.error('消息缺少服务端标识，无法撤回')
    return
  }

  if (!isGroup.value) {
    if (message.direction !== 'out') {
      toast.error('只能撤回自己发送的消息')
      return
    }
    if (Date.now() - message.timestamp > RECALL_WINDOW_MS) {
      toast.error('已超过 2 分钟撤回时限')
      return
    }
  }

  try {
    if (isGroup.value) {
      await chatApi.recallGroupMessage(message.sequence)
    } else {
      await chatApi.recallPrivateMessage(message.sequence)
    }
    chatStore.markMessageRecalled(chatId, message.sequence)
    if (isGroup.value && message.direction !== 'out') {
      toast.success('已撤回对方消息')
    } else {
      toast.success('消息已撤回')
    }
  } catch (error) {
    toast.error(resolveRecallErrorText(error, !!isGroup.value))
  }
}

const handleForward = async (payload: ForwardActionPayload) => {
  const chatId = props.chatId
  if (!chatId) return

  const fromId = userStore.userInfo?.id
  if (!fromId) {
    toast.error('请先登录')
    return
  }

  const sourceMessages = payload.messageIds
    .map((id) => chatStore.getMessageByLocalId(chatId, id))
    .filter((item): item is NonNullable<typeof item> => !!item)
    .filter((item) => item.status !== 'recalled')

  const targetIds = Array.from(new Set(payload.targetIds.filter(Boolean)))
  if (sourceMessages.length === 0) {
    toast.error('没有可转发的消息')
    return
  }
  if (targetIds.length === 0) {
    toast.error('请选择转发目标')
    return
  }

  let successCount = 0
  let failedCount = 0

  for (const targetId of targetIds) {
    chatStore.ensureSession(targetId)
    for (const source of sourceMessages) {
      if ((source.contentType === ContentType.IMAGE || source.contentType === ContentType.FILE) && !source.url) {
        failedCount += 1
        continue
      }

      const sequence = randomID()
      chatStore.appendOutgoingMessage(targetId, {
        localId: randomID(),
        sequence,
        fromId,
        toId: targetId,
        chatType: 1,
        contentType: source.contentType,
        content: source.content,
        url: source.url,
        fileName: source.fileName,
        fileSize: source.fileSize,
        timestamp: Date.now(),
      })

      try {
        await sendRealtimeMessage(
          targetId,
          1,
          {
            contentType: source.contentType,
            content: source.content,
            url: source.url,
            fileName: source.fileName,
            fileSize: source.fileSize,
          },
          sequence,
        )
        successCount += 1
      } catch {
        chatStore.markMessageFailedBySequence(sequence)
        failedCount += 1
      }
    }
  }

  if (failedCount === 0) {
    toast.success(`已转发 ${successCount} 条消息`)
  } else if (successCount === 0) {
    toast.error(`转发失败 ${failedCount} 条消息`)
  } else {
    toast.warning(`部分转发成功：成功 ${successCount} 条，失败 ${failedCount} 条`)
  }
}

const loadPrivateHistory = async (chatId: string) => {
  const current = currentUserId.value
  if (!current || historyLoadingByChatId.value[chatId]) return

  historyLoadingByChatId.value[chatId] = true
  try {
    const cursor = historyCursorByChatId.value[chatId] || undefined
    const res = await chatApi.getPrivateHistory({ peerId: chatId, cursor, limit: 20 })
    const payload = res.data
    const list = [...(payload?.list || [])].reverse()
    const mapped = list.map((item) => mapHistoryMessage(item, current))

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

const loadGroupHistory = async (chatId: string) => {
  const current = currentUserId.value
  if (!current || historyLoadingByChatId.value[chatId]) return

  historyLoadingByChatId.value[chatId] = true
  try {
    const cursor = historyCursorByChatId.value[chatId] || undefined
    const res = await chatApi.getGroupHistory({ groupId: extractGroupId(chatId), cursor, limit: 20 })
    const payload = res.data
    const list = [...(payload?.list || [])].reverse()
    const mapped = list.map((item) => mapHistoryMessage(item, current))

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

const loadGroupContext = async (chatId: string) => {
  try {
    const groupId = extractGroupId(chatId)
    const [groupRes, memberRes] = await Promise.all([
      socialApi.getGroupInfo(groupId),
      socialApi.getGroupMembers(groupId),
    ])

    groupInfo.value = groupRes.data || null
    groupMembers.value = memberRes.data || []

    if (groupRes.data) {
      chatStore.ensureSession({
        id: chatId,
        title: groupRes.data.remark || groupRes.data.name,
        avatar: groupRes.data.avatar || '',
        type: 2,
        subTitle: `${groupRes.data.memberCount || 0} 人 · ${groupRes.data.myTitleName || '群成员'}`,
      })
    }
  } catch {
    groupInfo.value = null
    groupMembers.value = []
  }
}

const handleLoadMoreHistory = () => {
  const chatId = props.chatId
  if (!chatId) return
  if (!historyHasMoreByChatId.value[chatId]) return

  if (isGroup.value) {
    void loadGroupHistory(chatId)
    return
  }
  void loadPrivateHistory(chatId)
}

watch(
  () => props.chatId,
  (newId) => {
    if (!newId) return

    if (!isGroup.value) {
      groupInfo.value = null
      groupMembers.value = []
      if (!historyInitializedByChatId.value[newId]) {
        const initializedFromLocal = initLocalHistoryCursor(newId)
        if (initializedFromLocal) return
        void loadPrivateHistory(newId)
      }
      return
    }

    void loadGroupContext(newId)
    if (!historyInitializedByChatId.value[newId]) {
      void loadGroupHistory(newId)
    }
  },
  { immediate: true },
)

watch(
  () => [props.chatId, route.query.groupId, route.query.sidebarTab] as const,
  () => {
    consumeGroupSidebarIntent()
  },
  { immediate: true },
)

onMounted(() => {
  offGroupUpdated = onGroupUpdated((groupId) => {
    const activeChatId = props.chatId
    if (!activeChatId || !activeChatId.startsWith('group_')) return
    if (extractGroupId(activeChatId) !== groupId) return
    void loadGroupContext(activeChatId)
  })
})

onBeforeUnmount(() => {
  offGroupUpdated?.()
  offGroupUpdated = null
})
</script>

<template>
  <div class="relative flex h-full w-full items-center justify-center overflow-hidden bg-background">
    <Transition name="fade" mode="out-in">
      <div v-if="chatId" key="chat" class="flex h-full w-full">
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
          :sending="sending"
          :group-member-map="groupMemberMap"
          :current-user-group-role="currentUserGroupRole"
          @send="handleSend"
          @retry="handleRetry"
          @recall="handleRecall"
          @forward="handleForward"
          @delete-local="handleDeleteLocal"
          @load-more-history="handleLoadMoreHistory"
        />
        <GroupSidebar
          v-if="isGroup"
          :group-id="chatId"
          :initial-tab="routeSidebarTab"
          :notice="groupInfo?.notice"
          :member-count="groupInfo?.memberCount"
          :my-nickname-in-group="groupInfo?.myNicknameInGroup"
          :my-title-name="groupInfo?.myTitleName"
          :can-manage="(groupInfo?.myPermissions || []).includes('GROUP_EDIT_INFO')"
          :members="groupMembers.map((member) => ({
            id: member.userId,
            name: member.nicknameInGroup || member.displayName || member.nickname || member.userId,
            avatar: member.avatar,
            role: member.role,
          }))"
        />
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
