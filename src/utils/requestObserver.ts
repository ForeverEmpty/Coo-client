import type { AxiosRequestConfig } from 'axios'

type RequestEventType = 'ERROR' | 'UNAUTHORIZED' | 'TIMEOUT'

export interface RequestErrorPayload {
  message: string
  code?: number
  config?: AxiosRequestConfig
}

type ObserverCallback = (event: RequestErrorPayload) => void

class RequestObserver {
  private listeners: Map<RequestEventType, ObserverCallback[]> = new Map()

  subscribe(eventType: RequestEventType, callback: ObserverCallback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }

    this.listeners.get(eventType)?.push(callback)

    return () => this.unsubscribe(eventType, callback)
  }

  unsubscribe(eventType: RequestEventType, callback: ObserverCallback) {
    const existingListeners = this.listeners.get(eventType) || []
    this.listeners.set(
      eventType,
      existingListeners.filter((cb) => cb !== callback),
    )
  }

  onError(callback: ObserverCallback) {
    return this.subscribe('ERROR', callback)
  }
  onUnauthorized(callback: ObserverCallback) {
    return this.subscribe('UNAUTHORIZED', callback)
  }
  onTimeout(callback: ObserverCallback) {
    return this.subscribe('TIMEOUT', callback)
  }

  emit(eventType: RequestEventType, event: RequestErrorPayload) {
    this.listeners.get(eventType)?.forEach((cb) => cb(event))
  }
}

export const requestObserver = new RequestObserver()
