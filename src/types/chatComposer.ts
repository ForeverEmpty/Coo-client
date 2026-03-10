export type ComposerAttachmentType = 'image' | 'file'

export interface ComposerAttachment {
  id: string
  type: ComposerAttachmentType
  file: File
  previewUrl?: string
  resolvedUrl?: string
  source?: 'picked' | 'paste-chat' | 'paste-external'
}

export interface ComposerPayload {
  text: string
  attachments: ComposerAttachment[]
  replyTo?: {
    messageId?: string
    senderName?: string
    content?: string
  }
}

export interface ComposerSendResult {
  clearText: boolean
  succeededAttachmentIds: string[]
}

export interface ForwardActionPayload {
  messageIds: string[]
  targetIds: string[]
}
