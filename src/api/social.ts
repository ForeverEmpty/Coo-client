import type { AxiosProgressEvent } from 'axios'
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
  GroupFileConfig,
  GroupFileFolder,
  GroupFileItem,
  GroupFileUploadResult,
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

  sortGroupTitles: (groupId: string, titleIds: string[]) =>
    request.put<Result<string>>(`social/group/${groupId}/titles/sort`, { titleIds }),

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

  getGroupFileConfig: (groupId: string) =>
    request.get<Result<GroupFileConfig>>(`social/group/${groupId}/files/config`),

  updateGroupFileConfig: (
    groupId: string,
    data: { fileCapacityMb?: number; oversizeThresholdMb?: number; tempExpireDays?: number },
  ) => request.put<Result<string>>(`social/group/${groupId}/files/config`, data),

  listGroupFolders: (groupId: string, parentId?: string) =>
    request.get<Result<GroupFileFolder[]>>(`social/group/${groupId}/files/folders`, {
      params: { parentId },
    }),

  createGroupFolder: (groupId: string, data: { parentId?: string; name: string }) =>
    request.post<Result<GroupFileFolder>>(`social/group/${groupId}/files/folders`, data),

  renameGroupFolder: (groupId: string, folderId: string, name: string) =>
    request.put<Result<string>>(`social/group/${groupId}/files/folders/${folderId}/rename`, { name }),

  moveGroupFolder: (groupId: string, folderId: string, targetFolderId?: string) =>
    request.put<Result<string>>(`social/group/${groupId}/files/folders/${folderId}/move`, { targetFolderId }),

  deleteGroupFolder: (groupId: string, folderId: string) =>
    request.delete<Result<string>>(`social/group/${groupId}/files/folders/${folderId}`),

  listGroupFiles: (groupId: string, params?: { folderId?: string; pageNum?: number; pageSize?: number }) =>
    request.get<Result<{ list: GroupFileItem[]; total: number; pageNum: number; pageSize: number; hasMore: boolean }>>(
      `social/group/${groupId}/files`,
      { params },
    ),

  uploadGroupFile: (
    groupId: string,
    file: File,
    payload?: { folderId?: string; source?: string; sourceMessageId?: string },
    onProgress?: (progress: number) => void,
  ) => {
    const formData = new FormData()
    formData.append('file', file)
    if (payload?.folderId) formData.append('folderId', payload.folderId)
    if (payload?.source) formData.append('source', payload.source)
    if (payload?.sourceMessageId) formData.append('sourceMessageId', payload.sourceMessageId)
    return request.post<Result<GroupFileUploadResult>>(`social/group/${groupId}/files/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (event.total) onProgress?.(Math.round((event.loaded * 100) / event.total))
      },
    })
  },

  renameGroupFile: (groupId: string, fileId: string, fileName: string) =>
    request.put<Result<string>>(`social/group/${groupId}/files/${fileId}/rename`, { fileName }),

  moveGroupFile: (groupId: string, fileId: string, targetFolderId?: string) =>
    request.put<Result<string>>(`social/group/${groupId}/files/${fileId}/move`, { targetFolderId }),

  deleteGroupFile: (groupId: string, fileId: string) =>
    request.delete<Result<string>>(`social/group/${groupId}/files/${fileId}`),
}
