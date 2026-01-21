import request from '@/utils/request'
import type { Result } from './types'

export interface UserInfo {
  id: number
  username: string
  nickname: string
  avatar: string
}

export const authApi = {
  register: (data: { username: string; password: string; nickname: string }) =>
    request.post<Result<UserInfo>>('auth/register', data),

  login: (data: { username: string; password: string }) =>
    request.post<Result<UserInfo>>('auth/login', data),
}
