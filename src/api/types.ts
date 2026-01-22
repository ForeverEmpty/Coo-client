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
  gender?: 'male' | 'female' | 'unknown'
  birth?: string
  region?: string
  job?: string
}
