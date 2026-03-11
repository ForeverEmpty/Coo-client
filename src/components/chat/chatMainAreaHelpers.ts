import { ContentType } from '@/api/enum'
import type { ChatUiMessage } from '@/stores/chatStore'
import { formatLocalDateTime } from '@/utils/dateTime'

export const BOTTOM_THRESHOLD = 24
export const MAX_BADGE_COUNT = 99
export const MAX_RECENT_EMOJI_COUNT = 24
export const RECENT_EMOJI_STORAGE_KEY = 'coo:chat:recent-emoji:v1'
export const PREVIEW_SCALE_MIN = 0.5
export const PREVIEW_SCALE_MAX = 4
export const PREVIEW_SCALE_STEP = 0.1
export const PREVIEW_CLICK_SCALE_STEP = 0.25
export const RECALL_WINDOW_MS = 2 * 60 * 1000

export const getCopyText = (message: ChatUiMessage) => {
  if (message.status === 'recalled') return '[已撤回]'
  if (message.contentType === ContentType.IMAGE || message.contentType === ContentType.FILE) {
    return message.url || message.content || ''
  }
  return message.content || ''
}

export const formatMessageTime = (timestamp: number) => {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return ''
  return formatLocalDateTime(new Date(ts), 'zh-CN')
}

export const formatFileSize = (size?: number) => {
  if (!size || !Number.isFinite(size) || size <= 0) return 'Unknown size'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export const isImageMessage = (message: ChatUiMessage) =>
  message.status !== 'recalled' && message.contentType === ContentType.IMAGE

export const isFileMessage = (message: ChatUiMessage) =>
  message.status !== 'recalled' && message.contentType === ContentType.FILE

export const getMediaSurfaceClass = (message: ChatUiMessage) =>
  message.direction === 'out'
    ? 'border-primary/30 bg-primary/5 shadow-primary/10'
    : 'border-border/70 bg-muted/40 shadow-black/5'

export const getMediaQuoteClass = (message: ChatUiMessage) =>
  `mb-2 rounded-2xl border px-2.5 py-1.5 text-xs ${getMediaSurfaceClass(message)}`

export const getImageMessageClass = (message: ChatUiMessage) =>
  `block overflow-hidden rounded-2xl border shadow-sm transition-colors ${getMediaSurfaceClass(message)}`

export const getFileMessageClass = (message: ChatUiMessage) =>
  `flex w-[18rem] max-w-full items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-sm transition-colors ${getMediaSurfaceClass(message)}`

export const parseImageSourcesFromHtml = (html: string) => {
  if (!html) return [] as string[]
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return Array.from(doc.querySelectorAll('img'))
    .map((img) => img.getAttribute('src')?.trim() || '')
    .filter(Boolean)
}

export const createImagePlaceholderFile = (name = 'pasted-image.png') =>
  new File([''], name, { type: 'image/png' })
