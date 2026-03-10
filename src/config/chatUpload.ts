export const CHAT_UPLOAD_LIMITS = {
  imageMaxSizeMB: 10,
  fileMaxSizeMB: 50,
} as const

export const CHAT_UPLOAD_ACCEPT = {
  image: 'image/*',
  file: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,.md',
} as const

const FILE_EXTENSIONS = new Set(
  CHAT_UPLOAD_ACCEPT.file
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
)

const toBytes = (sizeMB: number) => sizeMB * 1024 * 1024

export const CHAT_UPLOAD_BYTES_LIMIT = {
  image: toBytes(CHAT_UPLOAD_LIMITS.imageMaxSizeMB),
  file: toBytes(CHAT_UPLOAD_LIMITS.fileMaxSizeMB),
} as const

export const isAllowedImageFile = (file: File) => {
  return file.type.toLowerCase().startsWith('image/')
}

export const isAllowedGeneralFile = (file: File) => {
  const mime = (file.type || '').toLowerCase()
  const index = file.name.lastIndexOf('.')
  const extension = index >= 0 ? file.name.slice(index).toLowerCase() : ''

  if (extension && FILE_EXTENSIONS.has(extension)) {
    return true
  }

  // Fallback: allow a few common MIME families when extension is missing.
  if (!mime) return false
  return (
    mime.startsWith('text/') ||
    mime.includes('pdf') ||
    mime.includes('msword') ||
    mime.includes('officedocument') ||
    mime.includes('zip') ||
    mime.includes('compressed')
  )
}
