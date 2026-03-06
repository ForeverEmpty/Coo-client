import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { wsManager } from '../manager'

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []

  readonly url: string
  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  sent: string[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code, reason } as CloseEvent)
  }

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  triggerMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent)
  }

  static reset() {
    MockWebSocket.instances = []
  }
}

const getSocket = () => {
  const socket = MockWebSocket.instances[MockWebSocket.instances.length - 1]
  expect(socket).toBeTruthy()
  return socket as MockWebSocket
}

describe('wsManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
    MockWebSocket.reset()
    wsManager.setToken('')
    wsManager.disconnect('test reset')
  })

  afterEach(() => {
    wsManager.setToken('')
    wsManager.disconnect('test cleanup')
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('connects when token exists and appends token to url', () => {
    wsManager.setToken('abc-token')
    wsManager.connect()

    expect(MockWebSocket.instances).toHaveLength(1)
    const socket = getSocket()
    expect(socket.url).toContain('/api/chat')
    expect(socket.url).toContain('token=abc-token')
  })

  it('resolves sendChat when ACK with same sequence is received', async () => {
    wsManager.setToken('ack-token')
    wsManager.connect()

    const socket = getSocket()
    socket.triggerOpen()

    const promise = wsManager.sendChat({
      fromId: '1',
      toId: '2',
      chatType: 1,
      contentType: 1,
      content: 'hello',
      timestamp: Date.now(),
    })

    const firstPayload = socket.sent[0]
    expect(firstPayload).toBeDefined()
    const chatPayload = JSON.parse(firstPayload as string) as { sequence: string }
    socket.triggerMessage(JSON.stringify({ type: 'ACK', sequence: chatPayload.sequence, data: 'SENT' }))

    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects sendChat when ACK timeout is reached', async () => {
    wsManager.setToken('ack-timeout-token')
    wsManager.connect()

    const socket = getSocket()
    socket.triggerOpen()

    const promise = wsManager.sendChat(
      {
        fromId: '1',
        toId: '2',
        chatType: 1,
        contentType: 1,
        content: 'timeout',
        timestamp: Date.now(),
      },
      { timeoutMs: 100 },
    )

    const expectation = expect(promise).rejects.toThrow('ACK timeout')
    await vi.advanceTimersByTimeAsync(101)
    await expectation
  })

  it('starts reconnect after unexpected close', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    wsManager.setToken('reconnect-token')
    wsManager.connect()

    const socket = getSocket()
    socket.triggerOpen()
    socket.close(1006, 'abnormal close')

    expect(wsManager.getStatus()).toBe('reconnecting')

    await vi.advanceTimersByTimeAsync(1000)
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('updates pong timestamp when receiving PONG', async () => {
    let lastPongAt: number | null = null
    const unbindState = wsManager.bindState((snapshot) => {
      lastPongAt = snapshot.lastPongAt
    })

    wsManager.setToken('pong-token')
    wsManager.connect()

    const socket = getSocket()
    socket.triggerOpen()
    socket.triggerMessage(JSON.stringify({ type: 'PONG', sequence: 'pong-1' }))

    await vi.runOnlyPendingTimersAsync()
    expect(lastPongAt).not.toBeNull()

    unbindState()
  })
})
