import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { chatApi } from '@/api/chat'
import { useChatStore } from '../chatStore'

vi.mock('@/api/chat', () => ({
  chatApi: {
    getRecentPrivateChats: vi.fn(),
  },
}))

describe('chatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('supports setActiveChat with string and meta payload', () => {
    const store = useChatStore()

    store.setActiveChat('1001')
    expect(store.activeChatId).toBe('1001')
    expect(store.sessionMap['1001']?.title).toBe('1001')

    store.setActiveChat({
      id: '1002',
      title: 'Alice',
      avatar: 'avatar.png',
      type: 1,
      subTitle: 'online',
    })
    expect(store.activeChatId).toBe('1002')
    expect(store.sessionMap['1002']?.title).toBe('Alice')
  })

  it('updates message status by ACK sequence', () => {
    const store = useChatStore()
    const created = store.appendOutgoingMessage('1001', {
      localId: 'm1',
      sequence: 'seq-1',
      fromId: 'self',
      toId: '1001',
      chatType: 1,
      content: 'hello',
    })
    expect(created.status).toBe('sending')

    expect(store.markMessageFailedBySequence('seq-1')).toBe(true)
    expect(store.getMessages('1001')[0]?.status).toBe('failed')

    expect(store.markMessageSentBySequence('seq-1')).toBe(true)
    expect(store.getMessages('1001')[0]?.status).toBe('sent')
  })

  it('supports retry flow for failed outgoing message', () => {
    const store = useChatStore()
    store.appendOutgoingMessage('1001', {
      localId: 'm1',
      sequence: 'seq-old',
      fromId: 'self',
      toId: '1001',
      chatType: 1,
      content: 'retry me',
    })
    store.markMessageFailedBySequence('seq-old')

    const snapshot = store.retryFailedMessage('1001', 'm1')
    expect(snapshot).toBeTruthy()
    expect(snapshot?.status).toBe('sending')
    expect(snapshot?.sequence).toBeUndefined()

    expect(store.bindMessageSequence('1001', 'm1', 'seq-new')).toBe(true)
    expect(store.markMessageSentBySequence('seq-new')).toBe(true)
  })

  it('increments unread for inactive chat and clears on activation', () => {
    const store = useChatStore()

    store.setActiveChat('1001')
    store.incrementUnread('1002')
    store.incrementUnread('1002')
    expect(store.unreadByChatId['1002']).toBe(2)

    store.setActiveChat('1002')
    expect(store.unreadByChatId['1002']).toBe(0)
  })

  it('sorts recent chats by pinned first then last message time desc', () => {
    const store = useChatStore()

    store.ensureSession({ id: 'a', title: 'A', type: 1 })
    store.ensureSession({ id: 'b', title: 'B', type: 1 })
    store.ensureSession({ id: 'c', title: 'C', type: 1 })

    store.appendIncomingMessage('a', {
      fromId: 'a',
      toId: 'self',
      chatType: 1,
      content: 'a',
      timestamp: 1000,
    })
    store.appendIncomingMessage('b', {
      fromId: 'b',
      toId: 'self',
      chatType: 1,
      content: 'b',
      timestamp: 3000,
    })
    store.appendIncomingMessage('c', {
      fromId: 'c',
      toId: 'self',
      chatType: 1,
      content: 'c',
      timestamp: 2000,
    })

    store.pinChat('c')

    expect(store.recentChats.map((item) => item.chatId)).toEqual(['c', 'b', 'a'])
  })

  it('removeFromRecent hides item only and incoming message restores it', () => {
    const store = useChatStore()

    store.appendIncomingMessage('1001', {
      fromId: '1001',
      toId: 'self',
      chatType: 1,
      content: 'hello',
      timestamp: 1000,
    })
    expect(store.recentChats.find((item) => item.chatId === '1001')).toBeTruthy()

    store.removeFromRecent('1001')
    expect(store.recentChats.find((item) => item.chatId === '1001')).toBeFalsy()
    expect(store.getMessages('1001').length).toBe(1)

    store.appendIncomingMessage('1001', {
      fromId: '1001',
      toId: 'self',
      chatType: 1,
      content: 'new',
      timestamp: 2000,
    })
    expect(store.recentChats.find((item) => item.chatId === '1001')).toBeTruthy()
  })

  it('supports pin and unpin actions', () => {
    const store = useChatStore()

    expect(store.isPinned('1001')).toBe(false)
    store.pinChat('1001')
    expect(store.isPinned('1001')).toBe(true)
    store.unpinChat('1001')
    expect(store.isPinned('1001')).toBe(false)

    store.togglePinChat('1001')
    expect(store.isPinned('1001')).toBe(true)
    store.togglePinChat('1001')
    expect(store.isPinned('1001')).toBe(false)
  })

  it('persists and hydrates recent state by user id', async () => {
    const store = useChatStore()
    store.cacheMode = 'electron'
    store.ensureSession({ id: '1001', title: 'Alice', type: 1 })
    store.appendIncomingMessage('1001', {
      fromId: '1001',
      toId: 'self',
      chatType: 1,
      content: 'hello',
      timestamp: 12345,
    })
    store.pinChat('1001')
    store.incrementUnread('1001')
    await store.persistRecentState('u-1')

    setActivePinia(createPinia())
    const restored = useChatStore()
    restored.cacheMode = 'electron'
    expect(await restored.hydrateRecentState('u-1')).toBe(true)
    expect(restored.recentChats[0]?.chatId).toBe('1001')
    expect(restored.recentChats[0]?.title).toBe('Alice')
    expect(restored.recentChats[0]?.pinned).toBe(true)
    expect(restored.recentChats[0]?.unreadCount).toBe(1)
  })

  it('refreshes recent chats from server and keeps local newer snapshot', async () => {
    const mockedApi = vi.mocked(chatApi.getRecentPrivateChats)
    mockedApi.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: [
        {
          peerId: '1001',
          lastMessage: {
            id: 'm-1',
            fromId: '1001',
            toId: 'self',
            chatType: 1,
            contentType: 1,
            content: 'server older',
            timestamp: 1000,
            status: 0,
          },
        },
      ],
    })

    const store = useChatStore()
    store.ensureSession({ id: '1001', title: 'AliceLocal', type: 1 })
    store.appendIncomingMessage('1001', {
      fromId: '1001',
      toId: 'self',
      chatType: 1,
      content: 'local newer',
      timestamp: 2000,
    })

    await store.refreshRecentFromServer({
      currentUserId: 'self',
      friendMetaMap: { '1001': { title: 'AliceRemote' } },
    })

    expect(store.recentChats[0]?.lastMessageText).toBe('local newer')
    expect(store.sessionMap['1001']?.title).toBe('AliceLocal')
  })
})
