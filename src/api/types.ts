import type { ContentType, MessageType } from './enum'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Result<T = any> {
  code: number
  message: string
  data: T
}

export interface PageResult<T> {
  list: T[]
  total: number
  pageNum: number
  pageSize: number
  hasMore: boolean
}

export interface UserInfo {
  id: string
  username: string
  nickname: string
  avatar: string | null
  signature?: string
  status: number
  createTime: string

  isMe?: boolean
  gender?: number
  publicGender: boolean
  birthday?: string
  publicBirthday: boolean
  region?: string
  publicRegion: boolean
  job?: string
  publicJob: boolean
  backgroundUrl?: string
  publicMutualFriend: boolean
  isFriend?: boolean
}

export interface UserSimple {
  id: string
  username: string
  nickname: string
  avatar?: string
}

export interface PrivacySettings {
  publicGender?: boolean
  publicBirthday?: boolean
  publicRegion?: boolean
  publicJob?: boolean
  publicMutualFriend?: boolean
}

export interface EditProfileData {
  nickname: string
  gender?: number
  birthday?: string
  signature?: string
  region?: string
  job?: string
}

export interface ChatMessage {
  fromId: string
  toId: string
  chatType: 1 | 2
  contentType: ContentType
  content: string
  url?: string
  fileSize?: number
  fileName?: string
  timestamp: number | string
  replyTo?: {
    messageId?: string
    senderName?: string
    content?: string
  }
}

export interface ChatRecallMessage {
  messageId: string
  fromId: string
  toId: string
  chatType?: 1 | 2
  operatorId?: string
  timestamp: number | string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ProtocolModel<T = any> {
  type: MessageType
  sequence: string
  data?: T
}

export interface Friend extends UserSimple {
  remark?: string
  showName: string
  groupId: string
  status?: 1 | 2 | 3
}

export interface FriendGroup {
  groupId: string
  groupName: string
  children: Friend[]
}

export interface FriendApply {
  id: string
  fromId: string
  toId?: string
  source?: FriendApplySource
  nickname: string
  avatar?: string
  msg: string
  status: 0 | 1 | 2 | 3
  createTime: string
}

export type FriendApplySource = 'SEARCH' | 'QR' | 'GROUP'

export interface ApplyParams {
  targetId: string
  msg: string
  source: FriendApplySource
  remark?: string
  groupId?: string
}

export interface AuditParams {
  applyId: string
  status: 1 | 2 | 3
  remark?: string
  groupId?: string
}

export interface FriendRelationUpdateParams {
  friendId: string
  remark?: string
  groupId?: string
  status?: 1 | 2 | 3
}

export interface ChatHistoryMessage {
  id: string
  fromId: string
  toId: string
  chatType: 1 | 2
  contentType: ContentType
  content?: string
  url?: string
  fileName?: string
  fileSize?: number
  timestamp: number | string
  status: number
  replyTo?: {
    messageId?: string
    senderName?: string
    content?: string
  }
}

export interface ChatHistoryCursor {
  list: ChatHistoryMessage[]
  hasMore: boolean
  nextCursor?: string | null
}

export interface RecentPrivateChatItemVO {
  peerId: string
  lastMessage: ChatHistoryMessage
}

export interface ChatSessionConfig {
  pinnedChatIds: string[]
  hiddenRecentChatIds: string[]
  mutedChatIds: string[]
}

export interface MutualFriendListVO {
  total: number
  list: UserSimple[]
}

export type GroupPermission =
  | 'GROUP_VIEW'
  | 'GROUP_EDIT_INFO'
  | 'GROUP_EDIT_NOTICE'
  | 'GROUP_INVITE_MEMBER'
  | 'GROUP_REVIEW_INVITE'
  | 'GROUP_REVIEW_APPLY'
  | 'GROUP_REMOVE_MEMBER'
  | 'GROUP_ASSIGN_TITLE'
  | 'GROUP_MANAGE_TITLE'
  | 'GROUP_SET_SUPER_ADMIN'
  | 'GROUP_TRANSFER_OWNER'
  | 'GROUP_EDIT_MEMBER_NICKNAME'
  | 'GROUP_FILE_VIEW'
  | 'GROUP_FILE_UPLOAD'
  | 'GROUP_FILE_MANAGE'
  | 'GROUP_FILE_MANAGE_STORAGE'
  | 'GROUP_RECALL_ANYTIME'

export interface GroupListItem {
  id: string
  name: string
  ownerId?: string
  avatar?: string
  coverUrl?: string
  notice?: string
  remark?: string
  memberCount: number
  myRole?: number
  myTitleId?: string
  myTitleName?: string
  myNicknameInGroup?: string
}

export interface GroupInfo {
  id: string
  name: string
  avatar?: string
  coverUrl?: string
  notice?: string
  remark?: string
  ownerId: string
  inviteAuditMode: number
  defaultTitleId?: string
  memberCount: number
  myRole?: number
  myTitleId?: string
  myTitleName?: string
  myNicknameInGroup?: string
  myPermissions: GroupPermission[]
  fileCapacityMb?: number
  oversizeThresholdMb?: number
  tempExpireDays?: number
  usedStorageBytes?: number
}

export interface GroupMember {
  userId: string
  username?: string
  nickname?: string
  avatar?: string
  displayName: string
  nicknameInGroup?: string
  titleId?: string
  titleName?: string
  role: number
  permissions: GroupPermission[]
}

export interface GroupTitle {
  id: string
  name: string
  isDefault: boolean
  sort: number
  memberCount: number
  permissions: GroupPermission[]
}

export interface GroupJoinRequest {
  id: string
  groupId: string
  type: 'INVITE' | 'APPLY'
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'
  reason?: string
  auditBy?: string
  createTime: string
  fromUser?: UserSimple
  targetUser?: UserSimple
}

export interface GroupFileConfig {
  fileCapacityMb: number
  oversizeThresholdMb: number
  tempExpireDays: number
  usedStorageBytes: number
  remainingStorageBytes: number
}

export interface GroupFileFolder {
  id: string
  groupId: string
  parentId: string
  name: string
  createBy: string
  createTime: string
}

export interface GroupFileItem {
  id: string
  groupId: string
  folderId: string
  fileName: string
  url: string
  fileSize: number
  mimeType?: string
  source?: string
  sourceMessageId?: string
  temp: boolean
  expireAt?: string
  createBy: string
  createTime: string
}

export interface GroupFileUploadResult {
  fileId: string
  url: string
  fileName: string
  fileSize: number
  temp: boolean
  expireAt?: string
}

export interface GroupSearchItem {
  id: string
  name: string
  avatar?: string
  coverUrl?: string
  notice?: string
  memberCount: number
  joined: boolean
  pending: boolean
}

export interface GroupCreateParams {
  name: string
  avatar?: string
  coverUrl?: string
  notice?: string
  inviteAuditMode: number
  initialMemberIds?: string[]
}

export interface GroupUpdateParams {
  name?: string
  avatar?: string
  coverUrl?: string
  notice?: string
  inviteAuditMode?: number
}

export interface GroupInviteParams {
  targetUserIds: string[]
  reason?: string
}

export interface GroupApplyParams {
  reason?: string
}

export interface GroupJoinAuditParams {
  approve: boolean
  remark?: string
}

export interface GroupTransferOwnerParams {
  targetUserId: string
}

export interface GroupTitleCreateParams {
  name: string
  sort?: number
  permissions: GroupPermission[]
}

export interface GroupTitleUpdateParams {
  name: string
  sort?: number
  permissions: GroupPermission[]
}
