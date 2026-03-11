import request from '@/utils/request'
import type { ChatHistoryCursor, RecentPrivateChatItemVO, Result } from './types'

export const chatApi = {
  getPrivateHistory: (params: { peerId: string; cursor?: string; limit?: number }) =>
    request.get<Result<ChatHistoryCursor>>('chat/history/private', { params }),

  getGroupHistory: (params: { groupId: string; cursor?: string; limit?: number }) =>
    request.get<Result<ChatHistoryCursor>>('chat/history/group', { params }),

  getRecentPrivateChats: (params?: { limit?: number }) =>
    request.get<Result<RecentPrivateChatItemVO[]>>('chat/history/recent/private', { params }),

  recallPrivateMessage: (messageId: string) =>
    request.post<Result<string>>('chat/history/private/recall', { messageId }, { skipErrorHandler: true }),

  recallGroupMessage: (messageId: string) =>
    request.post<Result<string>>('chat/history/group/recall', { messageId }, { skipErrorHandler: true }),

  getGroupSharedImages: (params: { groupId: string; cursor?: string; limit?: number }) =>
    request.get<Result<ChatHistoryCursor>>('chat/history/group/shared/images', { params }),

  getGroupSharedFiles: (params: { groupId: string; cursor?: string; limit?: number }) =>
    request.get<Result<ChatHistoryCursor>>('chat/history/group/shared/files', { params }),

  uploadAttachment: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return request.post<Result<string>>('chat/attachment/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}
