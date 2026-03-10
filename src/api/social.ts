import request from '@/utils/request'
import type {
  ApplyParams,
  AuditParams,
  FriendRelationUpdateParams,
  FriendApply,
  FriendGroup,
  ChatSessionConfig,
  MutualFriendListVO,
  PageResult,
  Result,
  GroupApplyParams,
  GroupCreateParams,
  GroupInfo,
  GroupInviteParams,
  GroupJoinAuditParams,
  GroupJoinRequest,
  GroupListItem,
  GroupMember,
  GroupSearchItem,
  GroupTitle,
  GroupTitleCreateParams,
  GroupTitleUpdateParams,
  GroupUpdateParams,
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

  getMutualFriends: (targetId: string, limit = 6) =>
    request.get<Result<MutualFriendListVO>>(`social/friend/mutual/${targetId}`, {
      params: { limit },
    }),

  deleteFriend: (friendId: string) => request.delete<Result<string>>(`social/friend/${friendId}`),

  updateFriendRelation: (params: FriendRelationUpdateParams) =>
    request.put<Result<string>>('social/friend/relation', params),

  addFriendGroup: (name: string) => request.post<Result<string>>('social/friend/group', { name }),

  updateFriendGroup: (groupId: string, name: string) =>
    request.put<Result<string>>('social/friend/group', { groupId, name }),

  deleteFriendGroup: (groupId: string) =>
    request.delete<Result<string>>(`social/friend/group/${groupId}`),

  sortFriendGroups: (groupIds: string[]) =>
    request.put<Result<string>>('social/friend/group/sort', { groupIds }),

  getChatSessionConfig: () =>
    request.get<Result<ChatSessionConfig>>('social/friend/chat/session-config'),

  saveChatSessionConfig: (data: ChatSessionConfig) =>
    request.put<Result<string>>('social/friend/chat/session-config', data),

  getMyGroups: () => request.get<Result<GroupListItem[]>>('social/group/list/my'),

  searchGroups: (keyword: string) =>
    request.get<Result<GroupSearchItem[]>>('social/group/search', {
      params: { keyword },
    }),

  createGroup: (data: GroupCreateParams) => request.post<Result<GroupInfo>>('social/group', data),

  getGroupInfo: (groupId: string) => request.get<Result<GroupInfo>>(`social/group/${groupId}`),

  updateGroup: (groupId: string, data: GroupUpdateParams) =>
    request.put<Result<string>>(`social/group/${groupId}`, data),

  updateGroupRemark: (groupId: string, remark: string) =>
    request.put<Result<string>>(`social/group/${groupId}/remark`, { remark }),

  getGroupMembers: (groupId: string) =>
    request.get<Result<GroupMember[]>>(`social/group/${groupId}/members`),

  updateGroupMemberTitle: (groupId: string, userId: string, titleId: string) =>
    request.put<Result<string>>(`social/group/${groupId}/member/${userId}/title`, { titleId }),

  updateGroupMemberRole: (groupId: string, userId: string, role: number) =>
    request.put<Result<string>>(`social/group/${groupId}/member/${userId}/role`, { role }),

  removeGroupMember: (groupId: string, userId: string) =>
    request.delete<Result<string>>(`social/group/${groupId}/member/${userId}`),

  updateGroupMemberNickname: (groupId: string, userId: string, nicknameInGroup: string) =>
    request.put<Result<GroupMember>>(`social/group/${groupId}/member/${userId}/nickname`, {
      nicknameInGroup,
    }),

  updateMyGroupNickname: (groupId: string, nicknameInGroup: string) =>
    request.put<Result<GroupMember>>(`social/group/${groupId}/my-nickname`, {
      nicknameInGroup,
    }),

  getGroupTitles: (groupId: string) =>
    request.get<Result<GroupTitle[]>>(`social/group/${groupId}/titles`),

  createGroupTitle: (groupId: string, data: GroupTitleCreateParams) =>
    request.post<Result<string>>(`social/group/${groupId}/titles`, data),

  updateGroupTitle: (groupId: string, titleId: string, data: GroupTitleUpdateParams) =>
    request.put<Result<string>>(`social/group/${groupId}/titles/${titleId}`, data),

  setDefaultGroupTitle: (groupId: string, titleId: string) =>
    request.put<Result<string>>(`social/group/${groupId}/titles/${titleId}/default`),

  deleteGroupTitle: (groupId: string, titleId: string) =>
    request.delete<Result<string>>(`social/group/${groupId}/titles/${titleId}`),

  inviteGroupMembers: (groupId: string, data: GroupInviteParams) =>
    request.post<Result<string>>(`social/group/${groupId}/invite`, data),

  applyToGroup: (groupId: string, data: GroupApplyParams) =>
    request.post<Result<string>>(`social/group/${groupId}/apply`, data),

  getGroupJoinRequests: (groupId: string) =>
    request.get<Result<GroupJoinRequest[]>>(`social/group/${groupId}/join-requests`),

  auditGroupJoinRequest: (groupId: string, requestId: string, data: GroupJoinAuditParams) =>
    request.post<Result<string>>(`social/group/${groupId}/join-requests/${requestId}/audit`, data),

  leaveGroup: (groupId: string) => request.post<Result<string>>(`social/group/${groupId}/leave`),

  transferGroupOwner: (groupId: string, targetUserId: string) =>
    request.post<Result<string>>(`social/group/${groupId}/transfer-owner`, { targetUserId }),

  deleteGroup: (groupId: string) => request.delete<Result<string>>(`social/group/${groupId}`),
}
