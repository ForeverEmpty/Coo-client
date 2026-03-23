<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ContentType } from '@/api/enum'
import { chatApi } from '@/api/chat'
import { socialApi } from '@/api/social'
import type { ChatMessage, FriendGroup, GroupInfo, GroupMember } from '@/api/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ChatMainArea from './ChatMainArea.vue'
import ChatActionDrawer from '@/components/chat/ChatActionDrawer.vue'
import GroupInfoSidebar from '@/components/chat/GroupInfoSidebar.vue'
import EmptyState from './EmptyState.vue'
import {
  extractGroupId,
  mapHistoryMessageToUi,
  resolveRecallErrorText,
} from '@/components/chat/chatWindowHelpers'
import { useChatStore } from '@/stores/chatStore'
import { useContactStore } from '@/stores/contactStore'
import { useUserStore } from '@/stores/userStore'
import { usePlatform } from '@/composables/usePlatform'
import type {
  ComposerAttachment,
  ComposerPayload,
  ComposerSendResult,
  ForwardActionPayload,
} from '@/types/chatComposer'
import { wsManager } from '@/ws/manager'
import { randomID } from '@/utils/randomID'
import { emitGroupUpdated, onGroupUpdated } from '@/utils/groupSync'

const props = defineProps<{ chatId: string | null }>()

const chatStore = useChatStore()
const contactStore = useContactStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const { p, isElectron } = usePlatform()

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
const currentUserGroupPermissions = computed(() => groupInfo.value?.myPermissions || [])
const groupMemberMap = computed<Record<string, { name: string; avatar?: string }>>(() => {
  const map: Record<string, { name: string; avatar?: string }> = {}
  groupMembers.value.forEach((member) => {
    map[String(member.userId)] = {
      name: member.nicknameInGroup || member.displayName || member.nickname || member.username || String(member.userId),
      avatar: member.avatar || '',
    }
  })
  return map
})

const historyCursorByChatId = ref<Record<string, string | null>>({})
const historyHasMoreByChatId = ref<Record<string, boolean>>({})
const historyLoadingByChatId = ref<Record<string, boolean>>({})
const historyInitializedByChatId = ref<Record<string, boolean>>({})
const sending = ref(false)
const sidebarOpen = ref(false)
const sidebarLoading = ref(false)
const groupActionLoading = ref(false)
const privatePeerMeta = ref<{ id: string; title: string; avatar?: string } | null>(null)
const privateRelationStatus = ref<1 | 2 | 3 | null>(null)
const groupLeaveDialogOpen = ref(false)
const groupTransferDialogOpen = ref(false)
const groupDisbandDialogOpen = ref(false)
const transferTargetUserId = ref('')
const pendingRetryFileByLocalId = new Map<string, ComposerAttachment>()
const RECALL_WINDOW_MS = 2 * 60 * 1000
let offGroupUpdated: (() => void) | null = null

const historyLoading = computed(() => {
  if (!props.chatId) return false
  return !!historyLoadingByChatId.value[props.chatId]
})

const historyHasMore = computed(() => {
  if (!props.chatId) return false
  return !!historyHasMoreByChatId.value[props.chatId]
})

const isPrivateChat = computed(() => !!props.chatId && !isGroup.value)
const isGroupOwner = computed(() => {
  const currentUserId = String(userStore.userInfo?.id || '')
  return !!groupInfo.value?.ownerId && !!currentUserId && String(groupInfo.value.ownerId) === currentUserId
})
const isPinned = computed(() => (props.chatId ? chatStore.isPinned(props.chatId) : false))
const isMuted = computed(() => (props.chatId ? chatStore.isMuted(props.chatId) : false))
const isBlocked = computed(() => privateRelationStatus.value === 2)
const privatePeerUserId = computed(() => (isPrivateChat.value && props.chatId ? props.chatId : ''))

const privatePeerTitle = computed(() => {
  if (!isPrivateChat.value) return ''
  return (
    privatePeerMeta.value?.title ||
    sessionMeta.value?.title ||
    props.chatId ||
    ''
  )
})

const privatePeerAvatar = computed(() => {
  if (!isPrivateChat.value) return ''
  return privatePeerMeta.value?.avatar || sessionMeta.value?.avatar || ''
})

const groupTransferCandidates = computed(() => {
  const currentUser = String(userStore.userInfo?.id || '')
  return groupMembers.value.filter((member) => String(member.userId) !== currentUser)
})

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

const resolvePrivateFriendStatus = (groups: FriendGroup[], friendId: string) => {
  for (const group of groups || []) {
    const friend = (group.children || []).find((item) => String(item.id) === friendId)
    if (friend) {
      return (friend.status as 1 | 2 | 3 | undefined) || null
    }
  }
  return null
}

const loadPrivateSidebarData = async (chatId: string) => {
  if (!chatId || isGroup.value) return

  sidebarLoading.value = true
  try {
    const [infoRes, listRes] = await Promise.all([
      socialApi.getFriendInfo(chatId),
      socialApi.getFriendList(),
    ])

    const info = infoRes.data
    const groups = listRes.data || []
    privateRelationStatus.value = resolvePrivateFriendStatus(groups, chatId)

    const nextTitle =
      info?.nickname ||
      sessionMeta.value?.title ||
      chatId
    const nextAvatar = info?.avatar || sessionMeta.value?.avatar || ''

    privatePeerMeta.value = {
      id: chatId,
      title: nextTitle,
      avatar: nextAvatar,
    }

    chatStore.ensureSession({
      id: chatId,
      title: nextTitle,
      avatar: nextAvatar,
      type: 1,
      subTitle: sessionMeta.value?.subTitle || '在线',
    })
  } catch {
    privatePeerMeta.value = {
      id: chatId,
      title: sessionMeta.value?.title || chatId,
      avatar: sessionMeta.value?.avatar || '',
    }
    privateRelationStatus.value = privateRelationStatus.value ?? 1
  } finally {
    sidebarLoading.value = false
  }
}

const openSidebar = () => {
  sidebarOpen.value = true
  if (props.chatId && !isGroup.value) {
    void loadPrivateSidebarData(props.chatId)
    return
  }
  if (props.chatId && isGroup.value) {
    void loadGroupContext(props.chatId)
  }
}

const closeSidebar = () => {
  sidebarOpen.value = false
}

const handleGroupMemberClick = (userId: string) => {
  if (!userId) return
  closeSidebar()
  router.push(`/profile/${userId}`)
}

const handleOpenCurrentChatDetail = () => {
  const chatId = props.chatId
  if (!chatId) return

  if (isGroup.value) {
    const groupId = extractGroupId(chatId)
    closeSidebar()
    void router.push(`/groups/${groupId}`)
    return
  }

  closeSidebar()
  void router.push(`/profile/${chatId}`)
}

const handleOpenHistoryEntry = () => {
  if (!props.chatId) return
  toast.info('聊天记录入口已预留，可在主消息区滚动查看历史')
}

const handleTogglePin = () => {
  if (!props.chatId) return
  chatStore.togglePinChat(props.chatId)
  toast.success(chatStore.isPinned(props.chatId) ? '已置顶会话' : '已取消置顶')
}

const handleToggleMute = (value: boolean) => {
  if (!props.chatId) return
  if (value) {
    chatStore.muteChat(props.chatId)
    toast.success('已开启消息免打扰')
    return
  }
  chatStore.unmuteChat(props.chatId)
  toast.success('已关闭消息免打扰')
}

const handleToggleBlock = async () => {
  if (!props.chatId || isGroup.value) return
  const nextStatus: 1 | 2 = isBlocked.value ? 1 : 2

  try {
    await socialApi.updateFriendRelation({
      friendId: props.chatId,
      status: nextStatus,
    })
    privateRelationStatus.value = nextStatus
    toast.success(nextStatus === 2 ? '已拉黑该好友' : '已取消拉黑')
  } catch {
    // handled by request manager
  }
}

const handleClearMessages = () => {
  if (!props.chatId) return
  const localIds = chatStore.getMessages(props.chatId).map((item) => item.localId)
  if (localIds.length === 0) {
    toast.info('当前会话暂无可删除记录')
    return
  }
  chatStore.removeLocalMessages(props.chatId, localIds)
  chatStore.clearUnread(props.chatId)
  toast.success('已清空本端聊天记录')
}

const handleDeleteFriend = async () => {
  const chatId = props.chatId
  if (!chatId || isGroup.value) return
  try {
    await socialApi.deleteFriend(chatId)
    chatStore.removeFromRecent(chatId)
    chatStore.setActiveChat(null)
    closeSidebar()
    toast.success('已删除好友')
  } catch {
    // handled by request manager
  }
}

const getCurrentGroupContext = () => {
  const chatId = props.chatId
  if (!chatId || !isGroup.value) return null
  return {
    chatId,
    groupId: extractGroupId(chatId),
  }
}

const refreshGroupContextAfterMutation = async (groupId: string) => {
  await contactStore.fetchGroupChats(true)
  emitGroupUpdated(groupId)
  if (props.chatId && extractGroupId(props.chatId) === groupId) {
    await loadGroupContext(props.chatId)
  }
}

const handleOpenGroupFiles = () => {
  const context = getCurrentGroupContext()
  if (!context) return

  const routePath = `/groups/${context.groupId}/files`
  closeSidebar()
  if (isElectron) {
    p.send('open-window', {
      type: 'GROUP_FILES',
      route: routePath,
    })
    return
  }
  void router.push(routePath)
}

const handleOpenGroupNotice = () => {
  const context = getCurrentGroupContext()
  if (!context) return
  closeSidebar()
  void router.push({
    path: `/groups/${context.groupId}`,
    query: { focus: 'overview' },
  })
}

const openGroupLeaveDialog = () => {
  const context = getCurrentGroupContext()
  if (!context) return
  groupLeaveDialogOpen.value = true
}

const confirmLeaveGroup = async () => {
  const context = getCurrentGroupContext()
  if (!context) return

  groupActionLoading.value = true
  try {
    await socialApi.leaveGroup(context.groupId)
    chatStore.removeFromRecent(context.chatId)
    chatStore.setActiveChat(null)
    groupLeaveDialogOpen.value = false
    closeSidebar()
    await contactStore.fetchGroupChats(true)
    emitGroupUpdated(context.groupId)
    toast.success('已退出群聊')
  } finally {
    groupActionLoading.value = false
  }
}

const openGroupTransferDialog = () => {
  const context = getCurrentGroupContext()
  if (!context) return
  transferTargetUserId.value = ''
  groupTransferDialogOpen.value = true
}

const confirmTransferGroup = async () => {
  const context = getCurrentGroupContext()
  if (!context) return
  if (!transferTargetUserId.value) {
    toast.error('请选择转让目标成员')
    return
  }

  groupActionLoading.value = true
  try {
    await socialApi.transferGroupOwner(context.groupId, transferTargetUserId.value)
    groupTransferDialogOpen.value = false
    closeSidebar()
    await refreshGroupContextAfterMutation(context.groupId)
    toast.success('群主已转让')
  } finally {
    groupActionLoading.value = false
  }
}

const openGroupDisbandDialog = () => {
  const context = getCurrentGroupContext()
  if (!context) return
  groupDisbandDialogOpen.value = true
}

const confirmDisbandGroup = async () => {
  const context = getCurrentGroupContext()
  if (!context) return

  groupActionLoading.value = true
  try {
    await socialApi.deleteGroup(context.groupId)
    chatStore.removeFromRecent(context.chatId)
    chatStore.setActiveChat(null)
    groupDisbandDialogOpen.value = false
    closeSidebar()
    await contactStore.fetchGroupChats(true)
    emitGroupUpdated(context.groupId)
    toast.success('群已解散')
  } finally {
    groupActionLoading.value = false
  }
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
  let patched = false
  const contentType = attachment.type === 'image' ? ContentType.IMAGE : ContentType.FILE
  const fallbackContent = attachment.type === 'image' ? '[图片]' : attachment.file.name

  try {
    sequence = randomID()
    const uploadedUrl = attachment.resolvedUrl
      ? attachment.resolvedUrl
      : await (async () => {
          if (chatType === 2 && attachment.type === 'file') {
            const capacityMb = groupInfo.value?.fileCapacityMb || 1024
            const usedBytes = groupInfo.value?.usedStorageBytes || 0
            const thresholdMb = groupInfo.value?.oversizeThresholdMb || 100
            const remaining = capacityMb * 1024 * 1024 - usedBytes
            if (attachment.file.size > remaining && attachment.file.size <= thresholdMb * 1024 * 1024) {
              throw new Error('group storage full')
            }
            const response = await socialApi.uploadGroupFile(
              targetId,
              attachment.file,
              { source: 'CHAT_MESSAGE', sourceMessageId: sequence },
              undefined,
            )
            if (groupInfo.value && !response.data?.temp) {
              groupInfo.value.usedStorageBytes =
                Number(groupInfo.value.usedStorageBytes || 0) + attachment.file.size
            }
            return response.data?.url || ''
          }
          const response = await chatApi.uploadAttachment(attachment.file)
          return response.data || ''
        })()

    const url = uploadedUrl
    if (!url) {
      throw new Error('empty upload url')
    }

    chatStore.patchMessage(props.chatId!, localId, {
      sequence,
      url,
      fileName: attachment.file.name,
      fileSize: attachment.file.size,
      content: fallbackContent,
      status: 'sending',
    })
    patched = true

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
    if (patched && sequence) {
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
    const mapped = list.map((item) => mapHistoryMessageToUi(item, current))

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
    const mapped = list.map((item) => mapHistoryMessageToUi(item, current))

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
    closeSidebar()
    privatePeerMeta.value = null
    privateRelationStatus.value = null
    groupLeaveDialogOpen.value = false
    groupTransferDialogOpen.value = false
    groupDisbandDialogOpen.value = false
    transferTargetUserId.value = ''

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
    if (!props.chatId || !isGroup.value) return
    if (!route.query.sidebarTab) return

    const targetGroupId = String(route.query.groupId || '').trim()
    const currentGroupId = extractGroupId(props.chatId)
    if (targetGroupId && targetGroupId !== currentGroupId) return
    sidebarOpen.value = true
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
          :current-user-group-permissions="currentUserGroupPermissions"
          @send="handleSend"
          @retry="handleRetry"
          @recall="handleRecall"
          @forward="handleForward"
          @delete-local="handleDeleteLocal"
          @load-more-history="handleLoadMoreHistory"
          @open-sidebar="openSidebar"
          @open-detail="handleOpenCurrentChatDetail"
        />

        <GroupInfoSidebar
          v-if="isGroup"
          :notice="groupInfo?.notice"
          :member-count="groupInfo?.memberCount"
          :members="groupMembers"
          @member-click="handleGroupMemberClick"
        />

        <ChatActionDrawer
          :open="sidebarOpen"
          :is-group="isGroup"
          :loading="sidebarLoading || groupActionLoading"
          :title="privatePeerTitle"
          :avatar="privatePeerAvatar"
          :user-id="privatePeerUserId"
          :pinned="isPinned"
          :blocked="isBlocked"
          :muted="isMuted"
          :group-info="groupInfo"
          :group-members="groupMembers"
          @close="closeSidebar"
          @open-history="handleOpenHistoryEntry"
          @toggle-pin="handleTogglePin"
          @toggle-block="handleToggleBlock"
          @toggle-mute="handleToggleMute"
          @clear-messages="handleClearMessages"
          @delete-friend="handleDeleteFriend"
          @open-target-detail="handleOpenCurrentChatDetail"
          @member-click="handleGroupMemberClick"
          @open-group-files="handleOpenGroupFiles"
          @open-group-notice="handleOpenGroupNotice"
          @leave-group="openGroupLeaveDialog"
          @transfer-group="openGroupTransferDialog"
          @disband-group="openGroupDisbandDialog"
        />
      </div>

      <EmptyState v-else key="empty" />
    </Transition>

    <Dialog v-model:open="groupLeaveDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>退出群聊</DialogTitle>
          <DialogDescription>退出后将无法继续接收该群消息。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="groupLeaveDialogOpen = false">取消</Button>
          <Button variant="destructive" :disabled="groupActionLoading" @click="confirmLeaveGroup">
            {{ groupActionLoading ? '处理中...' : '退出群聊' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="groupTransferDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>转让群主</DialogTitle>
          <DialogDescription>请选择一名成员接任群主。</DialogDescription>
        </DialogHeader>
        <Select v-model:model-value="transferTargetUserId">
          <SelectTrigger>
            <SelectValue placeholder="选择成员" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="member in groupTransferCandidates"
              :key="member.userId"
              :value="member.userId"
            >
              {{ member.nicknameInGroup || member.displayName || member.nickname || member.userId }}
            </SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" @click="groupTransferDialogOpen = false">取消</Button>
          <Button
            :disabled="groupActionLoading || !transferTargetUserId"
            @click="confirmTransferGroup"
          >
            {{ groupActionLoading ? '处理中...' : '确认转让' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="groupDisbandDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>解散群聊</DialogTitle>
          <DialogDescription>解散后群将不可恢复，请谨慎操作。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="groupDisbandDialogOpen = false">取消</Button>
          <Button variant="destructive" :disabled="groupActionLoading" @click="confirmDisbandGroup">
            {{ groupActionLoading ? '处理中...' : '解散群聊' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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


