import { MessageType } from '@/api/enum'
import type { ChatMessage, ProtocolModel } from '@/api/types'
import { randomID } from '@/utils/randomID'
import type {
  AckPending,
  SendChatOptions,
  WSListener,
  WSProtocolMessageEventMap,
  WSStateSnapshot,
  WSStatus,
  WSEventType,
} from './types'

const HEARTBEAT_INTERVAL_MS = 25_000
const PONG_TIMEOUT_MS = 10_000
const ACK_TIMEOUT_MS = 5_000
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000]

class WebSocketManager {
  private socket: WebSocket | null = null
  private token = ''
  private status: WSStatus = 'idle'
  private retryCount = 0
  private manualClose = false

  private lastPingAt: number | null = null
  private lastPongAt: number | null = null
  private lastError: string | null = null

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private pongWatchTimer: ReturnType<typeof setTimeout> | null = null

  private stateHandler: ((snapshot: WSStateSnapshot) => void) | null = null
  private listeners = new Map<WSEventType, Set<(payload: unknown) => void>>()
  private pendingAck = new Map<string, AckPending>()

  setToken(token: string) {
    this.token = token.trim()
  }

  connect(force = false) {
    if (!this.token) {
      this.updateStatus('idle')
      return
    }

    const active = this.socket?.readyState === WebSocket.OPEN
    const connecting = this.socket?.readyState === WebSocket.CONNECTING
    if ((active || connecting) && !force) {
      return
    }

    if (force) {
      this.cleanupSocket(false)
      this.rejectAllPendingAck('socket replaced')
    }

    this.clearReconnectTimer()
    this.manualClose = false
    this.updateStatus(this.retryCount > 0 ? 'reconnecting' : 'connecting')

    try {
      const ws = new WebSocket(this.buildSocketUrl())
      this.bindSocketEvents(ws)
      this.socket = ws
    } catch (error) {
      this.setLastError(this.toErrorMessage(error))
      this.updateStatus('error')
      this.scheduleReconnect()
    }
  }

  disconnect(reason = 'manual disconnect') {
    this.manualClose = true
    this.clearReconnectTimer()
    this.stopHeartbeat()
    this.rejectAllPendingAck(reason)

    if (this.socket && this.socket.readyState < WebSocket.CLOSING) {
      this.socket.close(1000, reason.slice(0, 60))
    }
    this.cleanupSocket(true)

    this.updateStatus(this.token ? 'closed' : 'idle')
  }

  getStatus() {
    return this.status
  }

  send(model: ProtocolModel) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false
    }

    try {
      this.socket.send(JSON.stringify(model))
      return true
    } catch (error) {
      this.setLastError(this.toErrorMessage(error))
      return false
    }
  }

  sendChat(data: ChatMessage, options: SendChatOptions = {}) {
    const sequence = options.sequence || randomID()
    const model: ProtocolModel<ChatMessage> = {
      type: MessageType.CHAT,
      sequence,
      data,
    }

    const sent = this.send(model)
    if (!sent) {
      return Promise.reject(new Error('WebSocket not connected'))
    }

    if (options.requireAck === false) {
      return Promise.resolve()
    }

    const timeoutMs = options.timeoutMs ?? ACK_TIMEOUT_MS
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingAck.delete(sequence)
        reject(new Error(`ACK timeout: ${sequence}`))
      }, timeoutMs)

      this.pendingAck.set(sequence, { resolve, reject, timeoutId })
    })
  }

  subscribe<T extends WSEventType>(event: T, listener: WSListener<T>) {
    const bucket = this.listeners.get(event) ?? new Set<(payload: unknown) => void>()
    bucket.add(listener as (payload: unknown) => void)
    this.listeners.set(event, bucket)

    return () => {
      bucket.delete(listener as (payload: unknown) => void)
    }
  }

  bindState(handler: (snapshot: WSStateSnapshot) => void) {
    this.stateHandler = handler
    this.emitState()

    return () => {
      if (this.stateHandler === handler) {
        this.stateHandler = null
      }
    }
  }

  private bindSocketEvents(ws: WebSocket) {
    ws.onopen = (event) => {
      this.retryCount = 0
      this.setLastError(null)
      this.updateStatus('connected')
      this.startHeartbeat()
      this.emit('open', event)
    }

    ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : ''
      this.emit('raw-message', raw)
      if (!raw) {
        return
      }

      let model: ProtocolModel
      try {
        model = JSON.parse(raw)
      } catch {
        this.setLastError('WebSocket message parse failed')
        return
      }

      if (!model?.type) {
        return
      }

      this.emit('message', model)
      this.handleProtocolMessage(model)
    }

    ws.onerror = (event) => {
      this.setLastError('WebSocket connection error')
      this.updateStatus('error')
      this.emit('error', event)
    }

    ws.onclose = (event) => {
      this.stopHeartbeat()
      this.cleanupSocket(false)
      this.rejectAllPendingAck('socket closed')
      this.emit('close', event)

      if (this.manualClose || !this.token) {
        this.updateStatus(this.token ? 'closed' : 'idle')
        return
      }
      this.scheduleReconnect()
    }
  }

  private handleProtocolMessage(model: ProtocolModel) {
    const type = String(model.type || '').toUpperCase()

    if (type === MessageType.PONG) {
      this.lastPongAt = Date.now()
      this.clearPongWatchTimer()
      this.emitState()
      this.emit('pong', model)
      return
    }

    if (type === MessageType.ACK) {
      if (model.sequence) {
        this.resolveAck(model.sequence)
      }
      this.emit('ack', model as ProtocolModel<string>)
      return
    }

    if (type === MessageType.CHAT) {
      this.emit('chat', model as ProtocolModel<ChatMessage>)
      return
    }

    if (type === MessageType.RECALL) {
      this.emit('recall', model)
      return
    }

    if (type === MessageType.SYSTEM) {
      this.emit('system', model)
    }
  }

  private resolveAck(sequence: string) {
    const pending = this.pendingAck.get(sequence)
    if (!pending) {
      return
    }

    clearTimeout(pending.timeoutId)
    this.pendingAck.delete(sequence)
    pending.resolve()
  }

  private rejectAllPendingAck(reason: string) {
    this.pendingAck.forEach((pending) => {
      clearTimeout(pending.timeoutId)
      pending.reject(reason)
    })
    this.pendingAck.clear()
  }

  private startHeartbeat() {
    this.stopHeartbeat()

    this.heartbeatTimer = setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return
      }

      this.lastPingAt = Date.now()
      this.emitState()

      const ping: ProtocolModel = {
        type: MessageType.PING,
        sequence: randomID(),
      }
      this.send(ping)

      this.clearPongWatchTimer()
      this.pongWatchTimer = setTimeout(() => {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
          return
        }

        this.setLastError('PONG timeout')
        this.socket.close(4000, 'PONG timeout')
      }, PONG_TIMEOUT_MS)
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    this.clearPongWatchTimer()
  }

  private clearPongWatchTimer() {
    if (this.pongWatchTimer) {
      clearTimeout(this.pongWatchTimer)
      this.pongWatchTimer = null
    }
  }

  private scheduleReconnect() {
    if (!this.token) {
      return
    }

    this.clearReconnectTimer()

    const nextAttempt = this.retryCount + 1
    this.retryCount = nextAttempt
    this.updateStatus('reconnecting')

    const maxDelay = RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] || 30000
    const baseDelay = RETRY_DELAYS_MS[Math.min(nextAttempt - 1, RETRY_DELAYS_MS.length - 1)] || maxDelay
    const jitter = Math.floor(Math.random() * 300)
    const delay = baseDelay + jitter

    this.reconnectTimer = setTimeout(() => {
      if (!this.token) {
        this.updateStatus('idle')
        return
      }
      this.connect()
    }, delay)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private cleanupSocket(silent = false) {
    if (!this.socket) {
      return
    }

    this.socket.onopen = null
    this.socket.onmessage = null
    this.socket.onerror = null
    this.socket.onclose = null

    if (!silent && this.socket.readyState < WebSocket.CLOSING) {
      this.socket.close()
    }

    this.socket = null
  }

  private buildSocketUrl() {
    const explicitWs = `${import.meta.env.VITE_WS_URL || ''}`.trim()
    const apiBase = `${import.meta.env.VITE_API_BASE_URL || '/api'}`.trim()
    const source = explicitWs || apiBase
    const normalized = this.normalizeToWsUrl(source)
    const withChatPath = this.ensureChatPath(normalized)

    withChatPath.searchParams.set('token', this.token)
    return withChatPath.toString()
  }

  private normalizeToWsUrl(input: string) {
    const lower = input.toLowerCase()
    const hasWsProtocol = lower.startsWith('ws://') || lower.startsWith('wss://')
    const hasHttpProtocol = lower.startsWith('http://') || lower.startsWith('https://')

    let url: URL
    if (hasWsProtocol || hasHttpProtocol) {
      url = new URL(input)
    } else {
      url = new URL(input, window.location.origin)
    }

    if (url.protocol === 'http:') {
      url.protocol = 'ws:'
    } else if (url.protocol === 'https:') {
      url.protocol = 'wss:'
    }

    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    }

    return url
  }

  private ensureChatPath(url: URL) {
    const pathname = url.pathname.replace(/\/+$/, '')

    if (pathname.endsWith('/chat')) {
      return url
    }

    if (!pathname || pathname === '/') {
      url.pathname = '/api/chat'
      return url
    }

    if (pathname.endsWith('/api')) {
      url.pathname = `${pathname}/chat`
      return url
    }

    url.pathname = `${pathname}/chat`
    return url
  }

  private updateStatus(status: WSStatus) {
    this.status = status
    this.emitState()
    this.emit('status', status)
  }

  private setLastError(error: string | null) {
    this.lastError = error
    this.emitState()
  }

  private emitState() {
    this.stateHandler?.({
      status: this.status,
      connected: this.status === 'connected',
      retryCount: this.retryCount,
      lastPingAt: this.lastPingAt,
      lastPongAt: this.lastPongAt,
      lastError: this.lastError,
    })
  }

  private emit<T extends WSEventType>(event: T, payload: WSProtocolMessageEventMap[T]) {
    const bucket = this.listeners.get(event)
    if (!bucket || bucket.size === 0) {
      return
    }

    bucket.forEach((listener) => listener(payload))
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }
}

export const wsManager = new WebSocketManager()
