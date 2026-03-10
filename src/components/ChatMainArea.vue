<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertCircle,
  File as FileIcon,
  Image,
  Loader2,
  Minus,
  MoreHorizontal,
  Paperclip,
  Plus,
  RotateCcw,
  Send,
  Smile,
  X,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { ContentType } from '@/api/enum'
import { fileApi } from '@/api/file'
import { socialApi } from '@/api/social'
import type { FriendGroup } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { QuickContextMenu } from '@/components/ui/context-menu'
import { Resizer } from '@/components/common/resizer'
import { useClickOutside } from '@/composables/useClickOutside'
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
import { formatLocalDateTime } from '@/utils/dateTime'
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
  groupMemberMap?: Record<string, { name: string; avatar?: string; role?: number }>
  currentUserGroupRole?: number
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
}>()

const router = useRouter()
const chatStore = useChatStore()
const BOTTOM_THRESHOLD = 24
const MAX_BADGE_COUNT = 99
const MAX_RECENT_EMOJI_COUNT = 24
const RECENT_EMOJI_STORAGE_KEY = 'coo:chat:recent-emoji:v1'
const PREVIEW_SCALE_MIN = 0.5
const PREVIEW_SCALE_MAX = 4
const PREVIEW_SCALE_STEP = 0.1
const PREVIEW_CLICK_SCALE_STEP = 0.25
const RECALL_WINDOW_MS = 2 * 60 * 1000

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
const imageInputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const emojiButtonWrapRef = ref<HTMLElement | null>(null)
const emojiPanelRef = ref<HTMLElement | null>(null)

const previewImageUrl = ref('')
const imagePreviewOpen = ref(false)
const previewViewportRef = ref<HTMLElement | null>(null)
const previewImageRef = ref<HTMLImageElement | null>(null)
const previewScale = ref(1)
const previewTranslateX = ref(0)
const previewTranslateY = ref(0)
const previewDragging = ref(false)
const previewPointerId = ref<number | null>(null)
const previewDragStartX = ref(0)
const previewDragStartY = ref(0)
const previewDragOriginX = ref(0)
const previewDragOriginY = ref(0)
const previewDragMoved = ref(false)
const previewSkipClick = ref(false)

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
let removeWindowResizeListener: (() => void) | null = null

const canSend = computed(() => {
  if (props.sending) return false
  return inputText.value.trim().length > 0 || pendingAttachments.value.length > 0
})
const previewScaleText = computed(() => `${Math.round(previewScale.value * 100)}%`)
const selectedCount = computed(() => selectedMessageIds.value.size)
const quotedReply = computed(() => buildQuotedReply())
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
      role: mine?.role,
    }
  }

  if (props.isGroup) {
    const member = props.groupMemberMap?.[message.fromId]
    return {
      name: member?.name || message.fromId || '未知用户',
      avatar: member?.avatar || '',
      role: member?.role,
    }
  }

  return {
    name: props.peerName || message.fromId || '对方',
    avatar: props.peerAvatar || '',
    role: undefined,
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

const getCopyText = (message: ChatUiMessage) => {
  if (message.status === 'recalled') return '[已撤回]'
  if (message.contentType === ContentType.IMAGE || message.contentType === ContentType.FILE) {
    return message.url || message.content || ''
  }
  return message.content || ''
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
    toast.error('无可复制内容')
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
    toast.success('已复制')
  } catch {
    toast.error('复制失败')
  }
}

const canRecallMessage = (message: ChatUiMessage) => {
  if (props.isGroup) {
    if (message.status !== 'sent') return false
    if (!message.sequence) return false
    if (message.direction === 'out') {
      return Date.now() - message.timestamp <= RECALL_WINDOW_MS
    }
    return props.currentUserGroupRole === 1 || props.currentUserGroupRole === 2
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
      ? '[已撤回]'
      : message.contentType === ContentType.IMAGE
        ? '[图片]'
        : message.contentType === ContentType.FILE
          ? `[文件] ${message.fileName || message.content || ''}`.trim()
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
      toast.error('加载好友列表失败')
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
    toast.error('请选择转发对象')
    return
  }
  if (!forwardMessageIds.value.length) {
    toast.error('无可转发消息')
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
    toast.error('请先选中消息')
    return
  }
  void openForwardDialog(Array.from(selectedMessageIds.value))
}

const handleBatchDelete = () => {
  const ids = Array.from(selectedMessageIds.value)
  if (!ids.length) {
    toast.error('请先选中消息')
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

const createImagePlaceholderFile = (name = 'pasted-image.png') =>
  new File([''], name, { type: 'image/png' })

const parseImageSourcesFromHtml = (html: string) => {
  if (!html) return [] as string[]
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const nodes = Array.from(doc.querySelectorAll('img[src]'))
    return nodes
      .map((node) => node.getAttribute('src') || '')
      .map((src) => src.trim())
      .filter((src) => src.length > 0)
  } catch {
    return [] as string[]
  }
}

const toClipboardImageFile = (blob: Blob, fileName?: string) => {
  const ext = blob.type.split('/')[1] || 'png'
  const name = fileName || `pasted-${Date.now()}.${ext}`
  return new File([blob], name, { type: blob.type || 'image/png' })
}

const uploadPastedImage = async (file: File) => {
  const maxSize = CHAT_UPLOAD_BYTES_LIMIT.image
  if (!isAllowedImageFile(file)) {
    throw new Error('图片格式不支持')
  }
  if (file.size > maxSize) {
    throw new Error(`图片超过大小限制（${CHAT_UPLOAD_LIMITS.imageMaxSizeMB}MB）`)
  }
  const res = await fileApi.upload(file)
  const url = res.data
  if (!url) {
    throw new Error('图片上传失败')
  }
  return url
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
    throw new Error('图片下载失败')
  }
  const blob = await response.blob()
  const file = toClipboardImageFile(blob)
  const resolvedUrl = await uploadPastedImage(file)
  appendResolvedPastedImage(resolvedUrl, 'paste-external', file)
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
        const resolvedUrl = await uploadPastedImage(reuseFile)
        appendResolvedPastedImage(resolvedUrl, 'paste-external', reuseFile)
        handled = true
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '图片粘贴上传失败')
      }
      continue
    }

    try {
      await resolveExternalImageByUrl(src)
      handled = true
    } catch {
      toast.error('该图片无法直接粘贴上传，请先下载后再发送')
    }
  }

  for (const file of imageFiles) {
    try {
      const resolvedUrl = await uploadPastedImage(file)
      appendResolvedPastedImage(resolvedUrl, 'paste-external', file)
      handled = true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '图片粘贴上传失败')
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

const openImagePicker = () => {
  if (props.sending) return
  imageInputRef.value?.click()
}

const openFilePicker = () => {
  if (props.sending) return
  fileInputRef.value?.click()
}

const onImageInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  validateAndQueueFiles(target.files, 'image')
  target.value = ''
}

const onFileInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  validateAndQueueFiles(target.files, 'file')
  target.value = ''
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
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const resolveClampedPreviewTranslate = (x: number, y: number) => {
  const viewport = previewViewportRef.value
  const image = previewImageRef.value
  if (!viewport || !image || previewScale.value <= 1) {
    return { x: 0, y: 0 }
  }

  const baseWidth = image.clientWidth
  const baseHeight = image.clientHeight
  if (!baseWidth || !baseHeight) {
    return { x, y }
  }

  const scaledWidth = baseWidth * previewScale.value
  const scaledHeight = baseHeight * previewScale.value
  const maxX = Math.max(0, (scaledWidth - viewport.clientWidth) / 2)
  const maxY = Math.max(0, (scaledHeight - viewport.clientHeight) / 2)

  return {
    x: clamp(x, -maxX, maxX),
    y: clamp(y, -maxY, maxY),
  }
}

const applyPreviewTranslate = (x: number, y: number) => {
  const clamped = resolveClampedPreviewTranslate(x, y)
  previewTranslateX.value = clamped.x
  previewTranslateY.value = clamped.y
}

const resetPreviewTransform = () => {
  previewScale.value = 1
  previewTranslateX.value = 0
  previewTranslateY.value = 0
  previewDragging.value = false
  previewPointerId.value = null
}

const setPreviewScale = (nextScale: number) => {
  const clamped = clamp(nextScale, PREVIEW_SCALE_MIN, PREVIEW_SCALE_MAX)
  previewScale.value = clamped
  if (clamped <= 1) {
    previewTranslateX.value = 0
    previewTranslateY.value = 0
    previewDragging.value = false
    previewPointerId.value = null
    return
  }
  applyPreviewTranslate(previewTranslateX.value, previewTranslateY.value)
}

const zoomInPreview = () => {
  setPreviewScale(previewScale.value + PREVIEW_SCALE_STEP)
}

const zoomOutPreview = () => {
  setPreviewScale(previewScale.value - PREVIEW_SCALE_STEP)
}

const handlePreviewReset = () => {
  resetPreviewTransform()
}

const handlePreviewClose = () => {
  imagePreviewOpen.value = false
}

const handlePreviewWheel = (event: WheelEvent) => {
  const delta = event.deltaY < 0 ? PREVIEW_SCALE_STEP : -PREVIEW_SCALE_STEP
  setPreviewScale(previewScale.value + delta)
}

const handlePreviewPointerDown = (event: PointerEvent) => {
  if (previewScale.value <= 1) return
  const currentTarget = event.currentTarget as HTMLElement | null
  if (!currentTarget) return

  previewDragging.value = true
  previewDragMoved.value = false
  previewSkipClick.value = false
  previewPointerId.value = event.pointerId
  previewDragStartX.value = event.clientX
  previewDragStartY.value = event.clientY
  previewDragOriginX.value = previewTranslateX.value
  previewDragOriginY.value = previewTranslateY.value
  currentTarget.setPointerCapture(event.pointerId)
  event.preventDefault()
}

const handlePreviewPointerMove = (event: PointerEvent) => {
  if (!previewDragging.value) return
  if (previewPointerId.value !== event.pointerId) return

  const deltaX = event.clientX - previewDragStartX.value
  const deltaY = event.clientY - previewDragStartY.value
  if (!previewDragMoved.value && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
    previewDragMoved.value = true
  }
  applyPreviewTranslate(previewDragOriginX.value + deltaX, previewDragOriginY.value + deltaY)
}

const handlePreviewPointerUp = (event: PointerEvent) => {
  if (previewPointerId.value !== null && previewPointerId.value !== event.pointerId) return

  if (previewDragMoved.value) {
    previewSkipClick.value = true
  }
  previewDragging.value = false
  previewDragMoved.value = false
  previewPointerId.value = null
  const currentTarget = event.currentTarget as HTMLElement | null
  if (currentTarget?.hasPointerCapture(event.pointerId)) {
    currentTarget.releasePointerCapture(event.pointerId)
  }
}

const handlePreviewImageLoad = () => {
  applyPreviewTranslate(previewTranslateX.value, previewTranslateY.value)
}

const handlePreviewImageClick = (event: MouseEvent) => {
  if (previewSkipClick.value) {
    previewSkipClick.value = false
    return
  }

  // Let double-click handler own reset behavior.
  if (event.detail > 1) return

  setPreviewScale(previewScale.value + PREVIEW_CLICK_SCALE_STEP)
}

const openImagePreview = (url: string) => {
  if (!url) return
  resetPreviewTransform()
  previewImageUrl.value = url
  imagePreviewOpen.value = true
}

const formatMessageTime = (timestamp: number) => {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return ''
  return formatLocalDateTime(new Date(ts), 'zh-CN')
}

const formatFileSize = (size?: number) => {
  if (!size || !Number.isFinite(size) || size <= 0) return 'Unknown size'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const isImageMessage = (message: ChatUiMessage) =>
  message.status !== 'recalled' && message.contentType === ContentType.IMAGE

const isFileMessage = (message: ChatUiMessage) =>
  message.status !== 'recalled' && message.contentType === ContentType.FILE

const getMediaSurfaceClass = (message: ChatUiMessage) =>
  message.direction === 'out'
    ? 'border-primary/30 bg-primary/5 shadow-primary/10'
    : 'border-border/70 bg-muted/40 shadow-black/5'

const getMediaQuoteClass = (message: ChatUiMessage) =>
  `mb-2 rounded-2xl border px-2.5 py-1.5 text-xs ${getMediaSurfaceClass(message)}`

const getImageMessageClass = (message: ChatUiMessage) =>
  `block overflow-hidden rounded-2xl border shadow-sm transition-colors ${getMediaSurfaceClass(message)}`

const getFileMessageClass = (message: ChatUiMessage) =>
  `flex w-[18rem] max-w-full items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-sm transition-colors ${getMediaSurfaceClass(message)}`

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
    inputText.value = ''
    showEmojiPanel.value = false
    clearQuotedMessage()
    cancelSelection()
    forwardDialogOpen.value = false
    forwardMessageIds.value = []
    selectedForwardTargetIds.value = new Set()
    pendingAttachments.value.forEach(cleanupAttachmentPreview)
    pendingAttachments.value = []

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
  if (removeViewportScrollListener) {
    removeViewportScrollListener()
    removeViewportScrollListener = null
  }

  pendingAttachments.value.forEach(cleanupAttachmentPreview)
  pendingAttachments.value = []
  messageElMap.value.clear()
  clearUnreadState()
  retryTimers.forEach((timer) => clearTimeout(timer))
  retryTimers.clear()

  if (removeWindowResizeListener) {
    removeWindowResizeListener()
    removeWindowResizeListener = null
  }
})

useClickOutside(
  () => [emojiPanelRef, emojiButtonWrapRef],
  () => {
    showEmojiPanel.value = false
  },
  {
    enabled: () => showEmojiPanel.value,
  },
)
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
              {{ historyLoading ? '加载中...' : '加载更多消息' }}
            </Button>
          </div>

          <div
            v-for="msg in messages"
            :key="msg.localId"
            :ref="(el) => setMessageRef(msg.localId, el as Element | null)"
            class="group flex gap-3 max-w-[85%] rounded-xl px-1 py-1 transition-colors"
            :class="[
              msg.direction === 'out' ? 'ml-auto flex-row-reverse' : '',
              multiSelectMode && isMessageSelected(msg.localId)
                ? 'bg-primary/10 ring-1 ring-primary/30'
                : '',
            ]"
            @click="handleMessageItemClick(msg)"
          >
            <button
              v-if="multiSelectMode"
              class="mt-2 h-5 w-5 shrink-0 rounded-full border border-border/70 flex items-center justify-center transition-colors"
              :class="
                isMessageSelected(msg.localId)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background'
              "
              @click.stop="toggleSelectedMessage(msg.localId)"
            >
              <Check v-if="isMessageSelected(msg.localId)" class="h-3 w-3" />
            </button>

            <Avatar
              class="h-9 w-9 mt-1 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              @click.stop="handleAvatarClick(msg.fromId)"
            >
              <AvatarImage :src="getSenderMeta(msg).avatar || ''" />
              <AvatarFallback>
                {{ getSenderMeta(msg).name?.[0] || 'U' }}
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
                {{ getSenderMeta(msg).name }}
              </span>

              <QuickContextMenu
                :menu="buildMessageMenu(msg)"
                trigger="contextmenu"
                trigger-class="w-fit max-w-full"
              >
                <div class="max-w-full">
                  <div
                    v-if="msg.replyTo && msg.status !== 'recalled'"
                    :class="
                      isImageMessage(msg) || isFileMessage(msg)
                        ? getMediaQuoteClass(msg)
                        : 'mb-2 rounded-md border border-white/20 bg-black/10 px-2 py-1 text-xs opacity-85'
                    "
                  >
                    <p class="font-medium truncate">
                      {{ msg.replyTo.senderName || 'Quoted message' }}
                    </p>
                    <p class="truncate">{{ msg.replyTo.content || '[Message]' }}</p>
                  </div>

                  <template v-if="msg.status === 'recalled'">
                    <div
                      class="px-4 py-2.5 text-sm shadow-sm leading-relaxed whitespace-pre-wrap warp-break-words"
                      :class="
                        msg.direction === 'out'
                          ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-none'
                          : 'bg-muted/80 text-foreground rounded-2xl rounded-tl-none'
                      "
                    >
                      <span class="italic opacity-80">[Recalled]</span>
                    </div>
                  </template>

                  <template v-else-if="msg.contentType === ContentType.IMAGE">
                    <button
                      v-if="msg.url"
                      :class="getImageMessageClass(msg)"
                      @click.stop="openImagePreview(msg.url)"
                    >
                      <img
                        :src="msg.url"
                        alt="image message"
                        class="max-h-64 max-w-[18rem] object-cover"
                      />
                    </button>
                    <div
                      v-else
                      class="px-4 py-2.5 text-sm shadow-sm leading-relaxed whitespace-pre-wrap warp-break-words"
                      :class="
                        msg.direction === 'out'
                          ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-none'
                          : 'bg-muted/80 text-foreground rounded-2xl rounded-tl-none'
                      "
                    >
                      {{ msg.content || '[Image]' }}
                    </div>
                  </template>

                  <template v-else-if="msg.contentType === ContentType.FILE">
                    <a
                      v-if="msg.url"
                      :href="msg.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      :class="getFileMessageClass(msg)"
                      @click.stop
                    >
                      <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/70"
                      >
                        <FileIcon class="h-4 w-4" />
                      </div>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm font-medium">
                          {{ msg.fileName || msg.content || 'File' }}
                        </span>
                        <span class="mt-0.5 block text-[10px] text-muted-foreground">
                          {{ formatFileSize(msg.fileSize) }}
                        </span>
                      </span>
                    </a>
                    <div v-else :class="getFileMessageClass(msg)">
                      <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/70"
                      >
                        <FileIcon class="h-4 w-4" />
                      </div>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm font-medium">
                          {{ msg.fileName || msg.content || '[File]' }}
                        </span>
                        <span class="mt-0.5 block text-[10px] text-muted-foreground">
                          {{ formatFileSize(msg.fileSize) }}
                        </span>
                      </span>
                    </div>
                  </template>

                  <template v-else>
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
                  </template>
                </div>
              </QuickContextMenu>

              <div class="mt-1 mx-1 text-[10px] text-muted-foreground flex items-center gap-2">
                <span>{{ formatMessageTime(msg.timestamp) }}</span>
                <Loader2
                  v-if="msg.direction === 'out' && msg.status === 'sending'"
                  class="h-3.5 w-3.5 animate-spin text-muted-foreground/80"
                  title="发送中..."
                />
                <button
                  v-if="msg.direction === 'out' && msg.status === 'failed'"
                  class="relative text-red-500 hover:text-red-600 transition-colors"
                  :title="isRetryAnimating(msg.localId) ? '重试中...' : '发送失败，点击重试'"
                  @click.stop="handleRetryClick(msg.localId)"
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

    <Resizer v-model="footerHeight" direction="vertical" side="top" :min="120" :max="520" />

    <footer
      class="border-t bg-background flex flex-col shrink-0"
      :style="{ height: `${footerHeight}px` }"
    >
      <div
        v-if="multiSelectMode"
        class="flex items-center justify-between border-b px-3 py-2 bg-muted/20"
      >
        <span class="text-xs text-muted-foreground">已选择 {{ selectedCount }} 条消息</span>
        <div class="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            :disabled="selectedCount === 0"
            @click="handleBatchForward"
          >
            批量转发
          </Button>
          <Button
            size="sm"
            variant="destructive"
            :disabled="selectedCount === 0"
            @click="handleBatchDelete"
          >
            批量删除
          </Button>
          <Button size="sm" variant="ghost" @click="cancelSelection">取消选择</Button>
        </div>
      </div>

      <div class="relative flex items-center gap-1 px-2 pt-2">
        <div ref="emojiButtonWrapRef" class="contents">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground"
            :disabled="sending"
            @click="showEmojiPanel = !showEmojiPanel"
          >
            <Smile class="h-5 w-5" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-muted-foreground"
          :disabled="sending"
          @click="openImagePicker"
        >
          <Image class="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-muted-foreground"
          :disabled="sending"
          @click="openFilePicker"
        >
          <Paperclip class="h-5 w-5" />
        </Button>

        <input
          ref="imageInputRef"
          type="file"
          class="hidden"
          :accept="CHAT_UPLOAD_ACCEPT.image"
          multiple
          @change="onImageInputChange"
        />
        <input
          ref="fileInputRef"
          type="file"
          class="hidden"
          :accept="CHAT_UPLOAD_ACCEPT.file"
          multiple
          @change="onFileInputChange"
        />

        <div
          v-if="showEmojiPanel"
          ref="emojiPanelRef"
          class="absolute left-2 bottom-[calc(100%+0.5rem)] z-40 w-72 rounded-md border bg-popover p-2 shadow-md"
        >
          <div v-if="recentEmoji.length > 0" class="mb-2">
            <p class="text-[10px] text-muted-foreground mb-1">最近</p>
            <div class="grid grid-cols-8 gap-1">
              <button
                v-for="emoji in recentEmoji"
                :key="`recent-${emoji}`"
                type="button"
                class="rounded px-1 py-1 text-base hover:bg-accent"
                @click="handleEmojiPick(emoji)"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
          <div>
            <p class="text-[10px] text-muted-foreground mb-1">常用</p>
            <div class="max-h-64 overflow-y-auto pr-1">
              <div class="grid grid-cols-8 gap-1">
                <button
                  v-for="emoji in CHAT_EMOJI_POOL"
                  :key="emoji"
                  type="button"
                  class="rounded px-1 py-1 text-base hover:bg-accent"
                  @click="handleEmojiPick(emoji)"
                >
                  {{ emoji }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="pendingAttachments.length > 0" class="px-2 pt-2">
        <div class="flex flex-wrap gap-2">
          <div
            v-for="attachment in pendingAttachments"
            :key="attachment.id"
            class="relative flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5"
          >
            <img
              v-if="attachment.type === 'image' && attachment.previewUrl"
              :src="attachment.previewUrl"
              alt="pending image"
              class="h-10 w-10 rounded object-cover border"
            />
            <FileIcon v-else class="h-4 w-4 text-muted-foreground" />
            <div class="min-w-0">
              <p class="truncate text-xs font-medium max-w-40">{{ attachment.file.name }}</p>
              <p class="text-[10px] text-muted-foreground">
                {{ formatFileSize(attachment.file.size) }}
              </p>
            </div>
            <span
              v-if="sending"
              class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
            >
              发送中...
            </span>
            <button
              class="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
              :disabled="sending"
              @click="removeAttachment(attachment.id)"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="quotedMessage && quotedReply"
        class="mx-2 mt-2 flex items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
      >
        <div class="min-w-0">
          <p class="text-xs font-medium text-muted-foreground">
            回复 {{ quotedReply.senderName || '消息' }}
          </p>
          <p class="truncate text-xs">{{ quotedReply.content || '[消息]' }}</p>
        </div>
        <button
          class="rounded p-1 text-muted-foreground hover:text-foreground"
          @click="clearQuotedMessage"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>

      <div class="flex-1 flex gap-2 p-2 min-h-0">
        <div class="min-w-0 flex-1">
          <QuickContextMenu
            :menu="composerContextMenu"
            trigger="contextmenu"
            trigger-class="w-full h-full"
          >
            <textarea
              ref="textareaRef"
              v-model="inputText"
              placeholder=""
              class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex field-sizing-content min-h-16 h-full w-full rounded-md border bg-muted/30 px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 resize-none custom-scrollbar"
              :disabled="sending"
              @keydown="handleKeydown"
              @paste="(event) => void handleComposerPaste(event)"
            />
          </QuickContextMenu>
        </div>
        <div class="flex flex-col justify-end pb-1 pr-1">
          <Button
            size="icon"
            class="h-10 w-10 rounded-full shadow-md"
            :disabled="!canSend"
            @click="handleSend"
          >
            <Loader2 v-if="sending" class="h-5 w-5 animate-spin" />
            <Send v-else class="h-5 w-5" />
          </Button>
        </div>
      </div>
    </footer>

    <Dialog v-model:open="forwardDialogOpen">
      <DialogContent class="max-w-md p-0 overflow-hidden">
        <div class="border-b px-4 py-3">
          <h3 class="text-sm font-semibold">选择转发对象</h3>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ forwardMessageIds.length }} 条消息待转发
          </p>
        </div>
        <div class="max-h-80 overflow-y-auto p-2">
          <div v-if="forwardDialogLoading" class="py-10 text-center text-sm text-muted-foreground">
            加载中...
          </div>
          <div
            v-else-if="forwardFriends.length === 0"
            class="py-10 text-center text-sm text-muted-foreground"
          >
            暂无可用联系人
          </div>
          <button
            v-for="friend in forwardFriends"
            :key="friend.id"
            type="button"
            class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/50"
            :class="
              selectedForwardTargetIds.has(friend.id) ? 'bg-primary/10 ring-1 ring-primary/30' : ''
            "
            @click="toggleForwardTarget(friend.id)"
          >
            <Avatar class="h-8 w-8 rounded-full">
              <AvatarImage :src="friend.avatar || ''" />
              <AvatarFallback>{{ friend.name?.[0] || 'U' }}</AvatarFallback>
            </Avatar>
            <span class="min-w-0 flex-1 truncate text-sm">{{ friend.name }}</span>
            <Check v-if="selectedForwardTargetIds.has(friend.id)" class="h-4 w-4 text-primary" />
          </button>
        </div>
        <div class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button variant="ghost" @click="forwardDialogOpen = false">取消</Button>
          <Button :disabled="selectedForwardTargetIds.size === 0" @click="confirmForward">
            转发
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="imagePreviewOpen">
      <DialogContent
        :show-close-button="false"
        class="max-w-[min(96vw,1200px)] h-[88vh] p-0 overflow-hidden border-0 bg-black/95 text-white"
      >
        <div class="relative h-full w-full">
          <div
            class="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-md bg-black/60 px-2 py-1.5 backdrop-blur"
          >
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 rounded-md text-white hover:bg-white/20 hover:text-white"
              @click="zoomOutPreview"
            >
              <Minus class="h-4 w-4" />
            </Button>
            <span class="min-w-12 text-center text-xs font-semibold">{{ previewScaleText }}</span>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 rounded-md text-white hover:bg-white/20 hover:text-white"
              @click="zoomInPreview"
            >
              <Plus class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 rounded-md text-white hover:bg-white/20 hover:text-white"
              @click="handlePreviewReset"
            >
              <RotateCcw class="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            class="absolute top-3 right-3 z-20 h-9 rounded-md bg-black/70 px-3 text-white font-medium border border-white/25 hover:bg-black/90 hover:text-white"
            @click="handlePreviewClose"
          >
            <X class="h-4 w-4" />
          </Button>

          <div
            ref="previewViewportRef"
            class="h-full w-full overflow-hidden select-none flex items-center justify-center"
            @wheel.prevent="handlePreviewWheel"
            @pointermove="handlePreviewPointerMove"
            @pointerup="handlePreviewPointerUp"
            @pointercancel="handlePreviewPointerUp"
          >
            <img
              v-if="previewImageUrl"
              ref="previewImageRef"
              :src="previewImageUrl"
              alt="preview"
              class="max-h-full max-w-full object-contain rounded"
              :class="
                previewScale > 1
                  ? previewDragging
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
                  : 'cursor-zoom-in'
              "
              :style="{
                transform: `translate(${previewTranslateX}px, ${previewTranslateY}px) scale(${previewScale})`,
                transition: previewDragging ? 'none' : 'transform 120ms ease',
                willChange: 'transform',
              }"
              @load="handlePreviewImageLoad"
              @click="handlePreviewImageClick"
              @dblclick="handlePreviewReset"
              @pointerdown="handlePreviewPointerDown"
              @dragstart.prevent
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
