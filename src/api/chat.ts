import request from '@/utils/request'
import type { ChatHistoryCursor, RecentPrivateChatItemVO, Result } from './types'

export const chatApi = {
  getPrivateHistory: (params: { peerId: string; cursor?: string; limit?: number }) =>
    request.get<Result<ChatHistoryCursor>>('chat/history/private', { params }),

  getRecentPrivateChats: (params?: { limit?: number }) =>
    request.get<Result<RecentPrivateChatItemVO[]>>('chat/history/recent/private', { params }),
}
