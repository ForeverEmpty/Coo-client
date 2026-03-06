import request from '@/utils/request'
import type { ChatHistoryCursor, Result } from './types'

export const chatApi = {
  getPrivateHistory: (params: { peerId: string; cursor?: string; limit?: number }) =>
    request.get<Result<ChatHistoryCursor>>('chat/history/private', { params }),
}
