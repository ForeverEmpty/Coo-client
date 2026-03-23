<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ContentType } from '@/api/enum'
import { socialApi } from '@/api/social'
import type { FriendGroup } from '@/api/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Resizer } from '@/components/common/resizer'
import ChatAttachmentQueue from '@/components/chat/ChatAttachmentQueue.vue'
import ChatComposerInput from '@/components/chat/ChatComposerInput.vue'
import ChatComposerTools from '@/components/chat/ChatComposerTools.vue'
import ChatForwardDialog from '@/components/chat/ChatForwardDialog.vue'
import ChatHeaderBar from '@/components/chat/ChatHeaderBar.vue'
import ChatImagePreviewDialog from '@/components/chat/ChatImagePreviewDialog.vue'
import ChatMessageItem from '@/components/chat/ChatMessageItem.vue'
import ChatQuotedReplyBar from '@/components/chat/ChatQuotedReplyBar.vue'
import ChatSelectionToolbar from '@/components/chat/ChatSelectionToolbar.vue'
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge.vue'
import { useChatRetryState } from '@/components/chat/useChatRetryState'
import { useChatScrollState } from '@/components/chat/useChatScrollState'
import { createMessageContextMenu } from '@/config/menu'
import { CHAT_EMOJI_POOL } from '@/config/chatEmoji'
import {
  CHAT_UPLOAD_ACCEPT,
  CHAT_UPLOAD_BYTES_LIMIT,
  CHAT_UPLOAD_LIMITS,
  isAllowedGeneralFile,
  isAllowedImageFile,
} from '@/config/chatUpload'
import { useChatStore } from '@/stores/chatStore'
import type { ChatUiMessage } from '@/stores/chatStore'
import type {
  ComposerAttachment,
  ComposerPayload,
  ComposerSendResult,
  ForwardActionPayload,
} from '@/types/chatComposer'
import {
  BOTTOM_THRESHOLD,
  MAX_BADGE_COUNT,
  MAX_RECENT_EMOJI_COUNT,
  RECENT_EMOJI_STORAGE_KEY,
  RECALL_WINDOW_MS,
  createImagePlaceholderFile,
  getCopyText,
  parseImageSourcesFromHtml,
} from '@/components/chat/chatMainAreaHelpers'
import { useImagePreview } from '@/components/chat/useImagePreview'
import { randomID } from '@/utils/randomID'

const props = defineProps<{
  chatId: string
  title: string
  subTitle: string
  messages: ChatUiMessage[]
  isGroup?: boolean
  myAvatar?: string
  peerAvatar?: string
  peerName?: string
  groupMemberMap?: Record<string, { name: string; avatar?: string }>
  currentUserGroupPermissions?: string[]
  historyLoading?: boolean
  historyHasMore?: boolean
  sending?: boolean
}>()

const emit = defineEmits<{
  send: [payload: ComposerPayload, onResult?: (result: ComposerSendResult) => void]
  retry: [localId: string]
  recall: [localId: string]
  forward: [payload: ForwardActionPayload]
  deleteLocal: [localIds: string[]]
  loadMoreHistory: []
  openSidebar: []
  openDetail: []
}>()

const router = useRouter()
const chatStore = useChatStore()

const footerHeight = ref(220)
const inputText = ref('')
const showEmojiPanel = ref(false)
const recentEmoji = ref<string[]>([])
const pendingAttachments = ref<ComposerAttachment[]>([])
const quotedMessage = ref<ChatUiMessage | null>(null)
const multiSelectMode = ref(false)
const selectedMessageIds = ref<Set<string>>(new Set())

const forwardDialogOpen = ref(false)
const forwardDialogLoading = ref(false)
const forwardFriends = ref<Array<{ id: string; name: string; avatar?: string }>>([])
const forwardMessageIds = ref<string[]>([])
const selectedForwardTargetIds = ref<Set<string>>(new Set())

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const bottomAnchor = ref<HTMLElement | null>(null)
const scrollAreaHostRef = ref<HTMLElement | null>(null)

const {
  previewImageUrl,
  imagePreviewOpen,
  previewViewportRef,
  previewImageRef,
  previewScale,
  previewTranslateX,
  previewTranslateY,
  previewDragging,
  previewScaleText,
  applyPreviewTranslate,
  resetPreviewTransform,
  zoomInPreview,
  zoomOutPreview,
  handlePreviewReset,
  handlePreviewClose,
  handlePreviewWheel,
  handlePreviewPointerDown,
  handlePreviewPointerMove,
  handlePreviewPointerUp,
  handlePreviewImageLoad,
  handlePreviewImageClick,
  openImagePreview,
} = useImagePreview()

const handlePreviewViewportRefChange = (element: HTMLElement | null) => {
  previewViewportRef.value = element
}

const handlePreviewImageRefChange = (element: HTMLImageElement | null) => {
  previewImageRef.value = element
}

const { isRetryAnimating, markRetryAnimating, clearRetryState } = useChatRetryState()
const {
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
} = useChatScrollState({
  bottomThreshold: BOTTOM_THRESHOLD,
  maxBadgeCount: MAX_BADGE_COUNT,
  bottomAnchor,
  scrollAreaHostRef,
  topLoadThreshold: 24,
  canLoadMoreHistory: () => Boolean(props.historyHasMore),
  isHistoryLoading: () => Boolean(props.historyLoading),
  onReachTopLoadMore: () => emit('loadMoreHistory'),
})
let removeWindowResizeListener: (() => void) | null = null

const canSend = computed(() => {
  if (props.sending) return false
  return inputText.value.trim().length > 0 || pendingAttachments.value.length > 0
})
const selectedCount = computed(() => selectedMessageIds.value.size)
const selectedForwardTargetIdList = computed(() => Array.from(selectedForwardTargetIds.value))
const quotedReply = computed(() => buildQuotedReply())
const historyDividerText = computed(() => {
  if (props.historyLoading) return '正在加载历史消息...'
  if (props.historyHasMore) return '上滑自动加载更多历史消息'
  return '历史消息'
})
const loadedImageUrlSet = computed(() => {
  const urls = new Set<string>()
  Object.values(chatStore.messagesByChatId || {}).forEach((list) => {
    ;(list || []).forEach((item) => {
      if (item.contentType === ContentType.IMAGE && item.url) {
        urls.add(item.url)
      }
    })
  })
  return urls
})

const handleAvatarClick = (userId: string) => {
  if (!userId) return
  router.push(`/profile/${userId}`)
}

const getSenderMeta = (message: ChatUiMessage) => {
  if (message.direction === 'out') {
    const mine = props.groupMemberMap?.[message.fromId]
    return {
      name: mine?.name || '我',
      avatar: props.myAvatar || mine?.avatar || '',
    }
  }

  if (props.isGroup) {
    const member = props.groupMemberMap?.[message.fromId]
    return {
      name: member?.name || message.fromId || '未知用户',
      avatar: member?.avatar || '',
    }
  }

  return {
    name: props.peerName || message.fromId || '对方',
    avatar: props.peerAvatar || '',
  }
}

const persistRecentEmoji = () => {
  try {
    localStorage.setItem(RECENT_EMOJI_STORAGE_KEY, JSON.stringify(recentEmoji.value))
  } catch {
    // ignore storage errors
  }
}

const addRecentEmoji = (emoji: string) => {
  const next = [emoji, ...recentEmoji.value.filter((item) => item !== emoji)].slice(
    0,
    MAX_RECENT_EMOJI_COUNT,
  )
  recentEmoji.value = next
  persistRecentEmoji()
}

const insertTextAtCursor = (text: string) => {
  const textarea = textareaRef.value
  if (!textarea) {
    inputText.value += text
    return
  }

  const start = textarea.selectionStart ?? inputText.value.length
  const end = textarea.selectionEnd ?? inputText.value.length
  const before = inputText.value.slice(0, start)
  const after = inputText.value.slice(end)
  inputText.value = `${before}${text}${after}`

  nextTick(() => {
    const position = start + text.length
    textarea.focus()
    textarea.setSelectionRange(position, position)
  })
}

const handleEmojiPick = (emoji: string) => {
  insertTextAtCursor(emoji)
  addRecentEmoji(emoji)
}

const copyImageMessage = async (message: ChatUiMessage) => {
  if (!message.url) return false
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    return false
  }

  const response = await fetch(message.url)
  if (!response.ok) {
    throw new Error('复制图片失败')
  }

  const blob = await response.blob()
  const clipboardItem = new ClipboardItem({
    [blob.type || 'image/png']: blob,
    'text/plain': new Blob([message.url], { type: 'text/plain' }),
  })

  await navigator.clipboard.write([clipboardItem])
  return true
}

const copyMessage = async (message: ChatUiMessage) => {
  const text = getCopyText(message)
  if (!text.trim()) {
    toast.error('没有可复制的内容')
    return
  }
  try {
    if (message.contentType === ContentType.IMAGE && message.url) {
      const copiedAsImage = await copyImageMessage(message)
      if (!copiedAsImage) {
        await navigator.clipboard.writeText(text)
      }
    } else {
      await navigator.clipboard.writeText(text)
    }
    toast.success('复制成功')
  } catch {
    toast.error('复制失败')
  }
}

const canRecallMessage = (message: ChatUiMessage) => {
  const canRecallAnytime = (props.currentUserGroupPermissions || []).includes('GROUP_RECALL_ANYTIME')

  if (props.isGroup) {
    if (message.status !== 'sent') return false
    if (!message.sequence) return false
    if (message.direction === 'out') {
      return canRecallAnytime || Date.now() - message.timestamp <= RECALL_WINDOW_MS
    }
    return canRecallAnytime
  }
  if (message.direction !== 'out') return false
  if (message.status !== 'sent') return false
  if (!message.sequence) return false
  return Date.now() - message.timestamp <= RECALL_WINDOW_MS
}

const buildQuotedReply = () => {
  if (!quotedMessage.value) return undefined

  const message = quotedMessage.value
  const summary =
    message.status === 'recalled'
      ? '[已撤回消息]'
      : message.contentType === ContentType.IMAGE
        ? '[图片]'
        : message.contentType === ContentType.FILE
          ? ('[文件] ' + (message.fileName || message.content || '')).trim()
          : message.content || ''

  return {
    messageId: message.sequence || message.localId,
    senderName: getSenderMeta(message).name,
    content: summary || '[消息]',
  }
}

const clearQuotedMessage = () => {
  quotedMessage.value = null
}

const quoteMessage = (message: ChatUiMessage) => {
  quotedMessage.value = message
}

const toggleSelectedMessage = (localId: string) => {
  const next = new Set(selectedMessageIds.value)
  if (next.has(localId)) {
    next.delete(localId)
  } else {
    next.add(localId)
  }
  selectedMessageIds.value = next
}

const isMessageSelected = (localId: string) => selectedMessageIds.value.has(localId)

const handleMessageItemClick = (message: ChatUiMessage) => {
  if (!multiSelectMode.value) return
  toggleSelectedMessage(message.localId)
}

const cancelSelection = () => {
  multiSelectMode.value = false
  selectedMessageIds.value = new Set()
}

const selectMessage = (message: ChatUiMessage) => {
  multiSelectMode.value = true
  toggleSelectedMessage(message.localId)
}

const deleteMessagesLocal = (localIds: string[]) => {
  if (!localIds.length) return
  const next = new Set(selectedMessageIds.value)
  localIds.forEach((id) => next.delete(id))
  selectedMessageIds.value = next
  emit('deleteLocal', localIds)
  if (selectedMessageIds.value.size === 0) {
    multiSelectMode.value = false
  }
}

const openForwardDialog = async (messageIds: string[]) => {
  if (!messageIds.length) return

  forwardMessageIds.value = messageIds
  selectedForwardTargetIds.value = new Set()

  if (forwardFriends.value.length === 0) {
    forwardDialogLoading.value = true
    try {
      const groups = (await socialApi.getFriendList()).data || ([] as FriendGroup[])
      const map = new Map<string, { id: string; name: string; avatar?: string }>()
      groups.forEach((group) => {
        ;(group.children || []).forEach((friend) => {
          map.set(friend.id, {
            id: friend.id,
            name: friend.showName || friend.remark || friend.nickname || friend.id,
            avatar: friend.avatar || '',
          })
        })
      })
      forwardFriends.value = Array.from(map.values())
    } catch {
      toast.error('获取转发好友列表失败')
      return
    } finally {
      forwardDialogLoading.value = false
    }
  }

  forwardDialogOpen.value = true
}

const toggleForwardTarget = (targetId: string) => {
  const next = new Set(selectedForwardTargetIds.value)
  if (next.has(targetId)) {
    next.delete(targetId)
  } else {
    next.add(targetId)
  }
  selectedForwardTargetIds.value = next
}

const confirmForward = () => {
  const targetIds = Array.from(selectedForwardTargetIds.value)
  if (!targetIds.length) {
    toast.error('请选择转发目标')
    return
  }
  if (!forwardMessageIds.value.length) {
    toast.error('没有可转发的消息')
    return
  }

  emit('forward', {
    messageIds: [...forwardMessageIds.value],
    targetIds,
  })

  forwardDialogOpen.value = false
  forwardMessageIds.value = []
  selectedForwardTargetIds.value = new Set()
  cancelSelection()
}

const handleBatchForward = () => {
  if (selectedMessageIds.value.size === 0) {
    toast.error('请先选择消息')
    return
  }
  void openForwardDialog(Array.from(selectedMessageIds.value))
}

const handleBatchDelete = () => {
  const ids = Array.from(selectedMessageIds.value)
  if (!ids.length) {
    toast.error('请先选择消息')
    return
  }
  deleteMessagesLocal(ids)
}

const buildMessageMenu = (message: ChatUiMessage) =>
  createMessageContextMenu({
    keyPrefix: message.localId,
    canCopy: message.contentType !== ContentType.FILE,
    canRecall: canRecallMessage(message),
    canForward: message.status !== 'recalled',
    canSelect: true,
    onCopy: () => {
      void copyMessage(message)
    },
    onDelete: () => {
      deleteMessagesLocal([message.localId])
    },
    onRecall: () => {
      emit('recall', message.localId)
    },
    onQuote: () => {
      quoteMessage(message)
    },
    onForward: () => {
      void openForwardDialog([message.localId])
    },
    onSelect: () => {
      selectMessage(message)
    },
  })

const cleanupAttachmentPreview = (attachment: ComposerAttachment) => {
  if (!attachment.previewUrl) return
  if (!attachment.previewUrl.startsWith('blob:')) return
  URL.revokeObjectURL(attachment.previewUrl)
}

const removeAttachment = (attachmentId: string) => {
  const index = pendingAttachments.value.findIndex((item) => item.id === attachmentId)
  if (index < 0) return
  const [removed] = pendingAttachments.value.splice(index, 1)
  if (removed) {
    cleanupAttachmentPreview(removed)
  }
}

const clearSucceededAttachments = (ids: string[]) => {
  if (!ids.length) return
  const idSet = new Set(ids)
  const next: ComposerAttachment[] = []

  pendingAttachments.value.forEach((item) => {
    if (idSet.has(item.id)) {
      cleanupAttachmentPreview(item)
      return
    }
    next.push(item)
  })

  pendingAttachments.value = next
}

const toClipboardImageFile = (blob: Blob, fileName?: string) => {
  const ext = blob.type.split('/')[1] || 'png'
  const name = fileName || `pasted-${Date.now()}.${ext}`
  return new File([blob], name, { type: blob.type || 'image/png' })
}

const appendPendingPastedImage = (
  file: File,
  source: 'paste-chat' | 'paste-external' = 'paste-external',
) => {
  const maxSize = CHAT_UPLOAD_BYTES_LIMIT.image
  if (!isAllowedImageFile(file)) {
    throw new Error('仅支持图片文件')
  }
  if (file.size > maxSize) {
    throw new Error('图片体积不能超过 ' + CHAT_UPLOAD_LIMITS.imageMaxSizeMB + 'MB')
  }

  pendingAttachments.value = [
    ...pendingAttachments.value,
    {
      id: randomID(),
      type: 'image',
      file,
      previewUrl: URL.createObjectURL(file),
      source,
    },
  ]
}

const appendResolvedPastedImage = (
  resolvedUrl: string,
  source: 'paste-chat' | 'paste-external',
  file?: File,
) => {
  const nextFile = file || createImagePlaceholderFile()
  pendingAttachments.value = [
    ...pendingAttachments.value,
    {
      id: randomID(),
      type: 'image',
      file: nextFile,
      previewUrl: source === 'paste-chat' ? resolvedUrl : URL.createObjectURL(nextFile),
      resolvedUrl,
      source,
    },
  ]
}

const extractImageFilesFromEvent = (event: ClipboardEvent) => {
  const files: File[] = []
  const items = event.clipboardData?.items
  if (!items) return files
  for (const item of Array.from(items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return files
}

const extractImageFilesFromClipboardItems = async (items: ClipboardItem[]) => {
  const files: File[] = []
  let html = ''
  let text = ''
  for (const item of items) {
    if (!html && item.types.includes('text/html')) {
      try {
        const htmlBlob = await item.getType('text/html')
        html = await htmlBlob.text()
      } catch {
        // ignore html parse failure
      }
    }
    if (!text && item.types.includes('text/plain')) {
      try {
        const textBlob = await item.getType('text/plain')
        text = (await textBlob.text()).trim()
      } catch {
        // ignore plain text parse failure
      }
    }
    for (const type of item.types) {
      if (!type.startsWith('image/')) continue
      try {
        const blob = await item.getType(type)
        files.push(toClipboardImageFile(blob))
      } catch {
        // ignore unsupported clipboard item
      }
    }
  }
  return { html, files, text }
}

const resolveExternalImageByUrl = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('下载外部图片失败')
  }
  const blob = await response.blob()
  const file = toClipboardImageFile(blob)
  appendPendingPastedImage(file, 'paste-external')
}

const handleComposerPaste = async (event?: ClipboardEvent, clipboardItems?: ClipboardItem[]) => {
  const htmlFromEvent = event?.clipboardData?.getData('text/html') || ''
  const textFromEvent = event?.clipboardData?.getData('text/plain')?.trim() || ''
  const filesFromEvent = event ? extractImageFilesFromEvent(event) : []
  const fromClipboardRead = clipboardItems
    ? await extractImageFilesFromClipboardItems(clipboardItems)
    : { html: '', files: [] as File[], text: '' }

  const html = htmlFromEvent || fromClipboardRead.html
  const plainText = textFromEvent || fromClipboardRead.text
  const imageSources = parseImageSourcesFromHtml(html)
  const imageFiles = [...filesFromEvent, ...fromClipboardRead.files]

  if (
    imageSources.length === 0 &&
    imageFiles.length === 0 &&
    !loadedImageUrlSet.value.has(plainText)
  ) {
    return false
  }

  event?.preventDefault()

  let handled = false
  const reusedChatImageUrls = new Set<string>()

  if (plainText && loadedImageUrlSet.value.has(plainText)) {
    const reusedFile = imageFiles.length > 0 ? imageFiles.shift() : undefined
    appendResolvedPastedImage(plainText, 'paste-chat', reusedFile)
    reusedChatImageUrls.add(plainText)
    handled = true
  }

  for (const src of imageSources) {
    if (reusedChatImageUrls.has(src)) continue

    if (loadedImageUrlSet.value.has(src)) {
      const reusedFile = imageFiles.length > 0 ? imageFiles.shift() : undefined
      appendResolvedPastedImage(src, 'paste-chat', reusedFile)
      reusedChatImageUrls.add(src)
      handled = true
      continue
    }

    const reuseFile = imageFiles.shift()
    if (reuseFile) {
      try {
        appendPendingPastedImage(reuseFile, 'paste-external')
        handled = true
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '图片校验或处理失败')
      }
      continue
    }

    try {
      await resolveExternalImageByUrl(src)
      handled = true
    } catch {
      toast.error('外部图片无法拉取或上传失败')
    }
  }

  for (const file of imageFiles) {
    try {
      appendPendingPastedImage(file, 'paste-external')
      handled = true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '图片校验或处理失败')
    }
  }

  return handled
}

const selectAllComposerText = () => {
  const textarea = textareaRef.value
  if (!textarea) return
  textarea.focus()
  textarea.select()
}

const getComposerSelection = () => {
  const textarea = textareaRef.value
  if (!textarea) return { text: '', start: 0, end: 0 }
  const start = textarea.selectionStart ?? 0
  const end = textarea.selectionEnd ?? 0
  return {
    text: inputText.value.slice(start, end),
    start,
    end,
  }
}

const copyComposerText = async () => {
  const selection = getComposerSelection()
  if (!selection.text) return
  try {
    await navigator.clipboard.writeText(selection.text)
  } catch {
    toast.error('复制失败')
  }
}

const cutComposerText = async () => {
  const textarea = textareaRef.value
  if (!textarea) return
  const selection = getComposerSelection()
  if (!selection.text) return

  try {
    await navigator.clipboard.writeText(selection.text)
  } catch {
    toast.error('剪切失败')
    return
  }

  inputText.value = `${inputText.value.slice(0, selection.start)}${inputText.value.slice(selection.end)}`
  await nextTick()
  textarea.focus()
  textarea.setSelectionRange(selection.start, selection.start)
}

const pasteComposerContent = async () => {
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read()
      const handledImage = await handleComposerPaste(undefined, items)
      if (handledImage) return
    }
  } catch {
    // fallback to readText
  }

  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      insertTextAtCursor(text)
      return
    }
  } catch {
    // ignored
  }

  toast.info('请使用 Ctrl+V 粘贴')
}

const composerContextMenu = computed(() => [
  {
    key: 'composer-select-all',
    label: '全选',
    onSelect: () => {
      selectAllComposerText()
    },
  },
  {
    key: 'composer-copy',
    label: '复制',
    onSelect: () => {
      void copyComposerText()
    },
  },
  {
    key: 'composer-cut',
    label: '剪切',
    onSelect: () => {
      void cutComposerText()
    },
  },
  {
    key: 'composer-paste',
    label: '粘贴',
    onSelect: () => {
      void pasteComposerContent()
    },
  },
])

const validateAndQueueFiles = (files: FileList | null, target: 'image' | 'file') => {
  if (!files || files.length === 0) return
  const maxSize = target === 'image' ? CHAT_UPLOAD_BYTES_LIMIT.image : CHAT_UPLOAD_BYTES_LIMIT.file
  const maxSizeMB =
    target === 'image' ? CHAT_UPLOAD_LIMITS.imageMaxSizeMB : CHAT_UPLOAD_LIMITS.fileMaxSizeMB
  const queued: ComposerAttachment[] = []

  Array.from(files).forEach((file) => {
    if (!file) return

    if (target === 'image' && !isAllowedImageFile(file)) {
      toast.error('Only image files can be sent via image picker')
      return
    }
    if (target === 'file' && !isAllowedGeneralFile(file)) {
      toast.error('File type is not allowed')
      return
    }
    if (file.size > maxSize) {
      toast.error(`File exceeds size limit (${maxSizeMB}MB)`)
      return
    }

    queued.push({
      id: randomID(),
      type: target,
      file,
      previewUrl: target === 'image' ? URL.createObjectURL(file) : undefined,
      source: 'picked',
    })
  })

  if (queued.length > 0) {
    pendingAttachments.value = [...pendingAttachments.value, ...queued]
  }
}

const handleComposerFilesPicked = (payload: { files: FileList | null; target: 'image' | 'file' }) => {
  if (props.sending) return
  validateAndQueueFiles(payload.files, payload.target)
}

const handleTextareaRefChange = (element: HTMLTextAreaElement | null) => {
  textareaRef.value = element
}

const handleSend = () => {
  if (!canSend.value) return

  const replyTo = quotedReply.value
  const payload: ComposerPayload = {
    text: inputText.value,
    attachments: pendingAttachments.value.map((item) => ({
      id: item.id,
      type: item.type,
      file: item.file,
      previewUrl: item.previewUrl,
      resolvedUrl: item.resolvedUrl,
      source: item.source,
    })),
    replyTo: replyTo || undefined,
  }

  emit('send', payload, (result) => {
    if (result.clearText) {
      inputText.value = ''
    }
    clearSucceededAttachments(result.succeededAttachmentIds)
  })
  clearQuotedMessage()
  scrollToBottomSettled('smooth')
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

const handleRetryClick = (localId: string) => {
  emit('retry', localId)
  markRetryAnimating(localId)
}

const handleMessageMediaLoad = (message: ChatUiMessage) => {
  if (message.direction !== 'out' && !autoFollowLatest.value) return
  scrollToBottomSettled('auto')
}

watch(
  () => props.chatId,
  async () => {
    inputText.value = ''
    showEmojiPanel.value = false
    clearQuotedMessage()
    cancelSelection()
    forwardDialogOpen.value = false
    forwardMessageIds.value = []
    selectedForwardTargetIds.value = new Set()
    pendingAttachments.value.forEach(cleanupAttachmentPreview)
    pendingAttachments.value = []
    await resetForChatSwitch()
  },
  { immediate: true },
)

watch(
  () => props.messages.map((item) => item.localId),
  async (newIds, oldIds) => {
    await handleMessagesIdsChanged(newIds, oldIds, props.messages)
  },
)

watch(imagePreviewOpen, (open) => {
  if (open) {
    nextTick(() => {
      applyPreviewTranslate(previewTranslateX.value, previewTranslateY.value)
    })
    return
  }
  resetPreviewTransform()
  previewImageUrl.value = ''
})

onMounted(async () => {
  try {
    const raw = localStorage.getItem(RECENT_EMOJI_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        recentEmoji.value = parsed
          .filter((item) => typeof item === 'string')
          .slice(0, MAX_RECENT_EMOJI_COUNT)
      }
    }
  } catch {
    // ignore parse failures
  }

  await nextTick()
  bindViewport()
  await scrollToBottom()

  const onResize = () => {
    if (!imagePreviewOpen.value) return
    applyPreviewTranslate(previewTranslateX.value, previewTranslateY.value)
  }
  window.addEventListener('resize', onResize, { passive: true })
  removeWindowResizeListener = () => {
    window.removeEventListener('resize', onResize)
  }
})

onBeforeUnmount(() => {
  pendingAttachments.value.forEach(cleanupAttachmentPreview)
  pendingAttachments.value = []
  cleanupScrollState()
  clearRetryState()

  if (removeWindowResizeListener) {
    removeWindowResizeListener()
    removeWindowResizeListener = null
  }
})
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0 h-full">
    <ChatHeaderBar
      :title="title"
      :sub-title="subTitle"
      :is-group="isGroup"
      @open-sidebar="emit('openSidebar')"
      @open-detail="emit('openDetail')"
    />

    <div ref="scrollAreaHostRef" class="relative flex-1 min-h-0">
      <ScrollArea class="h-full px-6 pt-6 min-h-0">
        <div class="space-y-6">
          <div v-if="messages.length > 0" class="flex items-center gap-3 px-2">
            <div class="h-px flex-1 bg-border/70" />
            <span class="text-[11px] text-muted-foreground/80 whitespace-nowrap">
              {{ historyDividerText }}
            </span>
            <div class="h-px flex-1 bg-border/70" />
          </div>

          <ChatMessageItem
            v-for="msg in messages"
            :key="msg.localId"
            :msg="msg"
            :is-group="Boolean(isGroup)"
            :multi-select-mode="multiSelectMode"
            :is-selected="isMessageSelected(msg.localId)"
            :sender-meta="getSenderMeta(msg)"
            :message-menu="buildMessageMenu(msg)"
            :retry-animating="isRetryAnimating(msg.localId)"
            :row-ref="(el) => setMessageRef(msg.localId, el)"
            @item-click="handleMessageItemClick"
            @toggle-select="toggleSelectedMessage"
            @avatar-click="handleAvatarClick"
            @open-image="openImagePreview"
            @retry="handleRetryClick"
            @media-load="handleMessageMediaLoad"
          />
          <div ref="bottomAnchor" />
        </div>
      </ScrollArea>

      <ChatUnreadBadge
        :visible="visibleUnreadCount > 0"
        :text="badgeText()"
        @click="handleJumpFirstUnread"
      />
    </div>

    <Resizer v-model="footerHeight" direction="vertical" side="top" :min="120" :max="520" />

    <footer
      class="border-t bg-background flex flex-col shrink-0"
      :style="{ height: `${footerHeight}px` }"
    >
      <ChatSelectionToolbar
        v-if="multiSelectMode"
        :selected-count="selectedCount"
        @batch-forward="handleBatchForward"
        @batch-delete="handleBatchDelete"
        @cancel="cancelSelection"
      />

      <ChatComposerTools
        v-model:show-emoji-panel="showEmojiPanel"
        :sending="sending"
        :recent-emoji="recentEmoji"
        :emoji-pool="CHAT_EMOJI_POOL"
        :image-accept="CHAT_UPLOAD_ACCEPT.image"
        :file-accept="CHAT_UPLOAD_ACCEPT.file"
        @emoji-pick="handleEmojiPick"
        @files-picked="handleComposerFilesPicked"
      />
      <ChatAttachmentQueue
        :attachments="pendingAttachments"
        :sending="sending"
        @remove="removeAttachment"
      />

      <ChatQuotedReplyBar
        :visible="Boolean(quotedMessage && quotedReply)"
        :sender-name="quotedReply?.senderName || ''"
        :content="quotedReply?.content || ''"
        @clear="clearQuotedMessage"
      />

      <ChatComposerInput
        v-model="inputText"
        :disabled="sending"
        :can-send="canSend"
        :menu="composerContextMenu"
        @send="handleSend"
        @keydown="handleKeydown"
        @paste="(event) => void handleComposerPaste(event)"
        @textarea-ref-change="handleTextareaRefChange"
      />
    </footer>
    <ChatForwardDialog
      v-model:open="forwardDialogOpen"
      :loading="forwardDialogLoading"
      :message-count="forwardMessageIds.length"
      :friends="forwardFriends"
      :selected-target-ids="selectedForwardTargetIdList"
      @toggle-target="toggleForwardTarget"
      @confirm="confirmForward"
    />

    <ChatImagePreviewDialog
      v-model:open="imagePreviewOpen"
      :image-url="previewImageUrl"
      :scale="previewScale"
      :translate-x="previewTranslateX"
      :translate-y="previewTranslateY"
      :dragging="previewDragging"
      :scale-text="previewScaleText"
      @zoom-in="zoomInPreview"
      @zoom-out="zoomOutPreview"
      @reset="handlePreviewReset"
      @close="handlePreviewClose"
      @wheel="handlePreviewWheel"
      @pointer-move="handlePreviewPointerMove"
      @pointer-up="handlePreviewPointerUp"
      @image-load="handlePreviewImageLoad"
      @image-click="handlePreviewImageClick"
      @pointer-down="handlePreviewPointerDown"
      @viewport-ref-change="handlePreviewViewportRefChange"
      @image-ref-change="handlePreviewImageRefChange"
    />
  </div>
</template>

