import type { ChatMessage, ChatRecallMessage, ProtocolModel } from '@/api/types'

export type WSStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error'

export interface WSStateSnapshot {
  status: WSStatus
  connected: boolean
  retryCount: number
  lastPingAt: number | null
  lastPongAt: number | null
  lastError: string | null
}

export interface SendChatOptions {
  requireAck?: boolean
  timeoutMs?: number
  sequence?: string
}

export interface AckPending {
  resolve: () => void
  reject: (reason?: string) => void
  timeoutId: ReturnType<typeof setTimeout>
}

export interface WSProtocolMessageEventMap {
  open: Event
  close: CloseEvent
  error: Event
  'raw-message': string
  message: ProtocolModel
  chat: ProtocolModel<ChatMessage>
  recall: ProtocolModel<ChatRecallMessage>
  system: ProtocolModel
  pong: ProtocolModel
  ack: ProtocolModel<string>
  status: WSStatus
}

export type WSEventType = keyof WSProtocolMessageEventMap
export type WSListener<T extends WSEventType> = (payload: WSProtocolMessageEventMap[T]) => void
