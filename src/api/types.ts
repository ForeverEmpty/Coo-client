import type { ContentType, MessageType } from './enum'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Result<T = any> {
  code: number
  msg: string
  data: T
}

export interface PageResult<T> {
  list: T[]
  total: number
  pageNum: number
  pageSize: number
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
  publicGender?: boolean
  birthday?: string
  publicBirthday?: boolean
  region?: string
  publicRegion?: boolean
  job?: string
  publicJob?: boolean
  backgroundUrl?: string
  publicMutualFriend?: boolean
}

export interface PrivacySettings {
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
  timestamp: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ProtocolModel<T = any> {
  type: MessageType
  sequence: string
  data?: T
}
