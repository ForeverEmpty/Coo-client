import request from '@/utils/request'
import type {
  ApplyParams,
  AuditParams,
  FriendApply,
  FriendGroup,
  PageResult,
  Result,
  UserSimple,
} from './types'

export const socialApi = {
  searchGlobal: (keyword: string, pageNum: number, pageSize: number) =>
    request.get<Result<PageResult<UserSimple>>>('social/friend/search/global', {
      params: { keyword, pageNum, pageSize },
    }),

  getFriendList: () => request.get<Result<FriendGroup[]>>('social/friend/list'),

  applyFriend: (params: ApplyParams) => request.post<Result<string>>('social/friend/apply', params),

  getApplyList: () => request.get<Result<FriendApply[]>>('social/friend/apply/list'),

  auditApply: (data: AuditParams) => request.post<Result<string>>('social/friend/audit', data),
}
