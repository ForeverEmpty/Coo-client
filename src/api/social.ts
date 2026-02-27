import request from '@/utils/request'
import type {
  ApplyParams,
  AuditParams,
  FriendApply,
  FriendGroup,
  PageResult,
  Result,
  UserSimple,
  UserInfo,
} from './types'

export const socialApi = {
  searchGlobal: (keyword: string, pageNum: number, pageSize: number) =>
    request.get<Result<PageResult<UserSimple>>>('social/friend/search/global', {
      params: { keyword, pageNum, pageSize },
    }),

  getFriendList: () => request.get<Result<FriendGroup[]>>('social/friend/list'),

  applyFriend: (params: ApplyParams) => request.post<Result<string>>('social/friend/apply', params),

  getApplyList: () => request.get<Result<FriendApply[]>>('social/friend/apply/list'),

  getSentApplyList: () => request.get<Result<FriendApply[]>>('social/friend/apply/list/sent'),

  auditApply: (data: AuditParams) => request.post<Result<string>>('social/friend/audit', data),

  unignoreApply: (applyId: string) =>
    request.post<Result<string>>(`social/friend/unignore/${applyId}`),

  getFriendInfo: (id: string) => request.get<Result<UserInfo>>(`social/friend/info/${id}`),

  deleteFriend: (friendId: string) => request.delete<Result<string>>(`social/friend/${friendId}`),

  addFriendGroup: (name: string) => request.post<Result<string>>('social/friend/group', { name }),

  updateFriendGroup: (groupId: string | number, name: string) =>
    request.put<Result<string>>('social/friend/group', { groupId, name }),

  deleteFriendGroup: (groupId: string | number) =>
    request.delete<Result<string>>(`social/friend/group/${groupId}`),

  sortFriendGroups: (groupIds: (string | number)[]) =>
    request.put<Result<string>>('social/friend/group/sort', { groupIds }),
}
