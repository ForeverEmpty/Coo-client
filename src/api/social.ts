import request from '@/utils/request'
import type {
  ApplyParams,
  AuditParams,
  FriendApply,
  FriendGroup,
  Result,
  UserSimple,
} from './types'

export const socialApi = {
  searchUser: (keyword: string) =>
    request.get<Result<UserSimple[]>>('social/friend/search', { params: { keyword } }),

  getFriendList: () => request.get<Result<FriendGroup[]>>('social/friend/list'),

  applyFriend: (params: ApplyParams) => request.post<Result<string>>('social/friend/apply', params),

  getApplyList: () => request.get<Result<FriendApply[]>>('social/friend/apply/list'),

  auditApply: (data: AuditParams) => request.post<Result<string>>('social/friend/audit', data),
}
