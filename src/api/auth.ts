import request from '@/utils/request'
import type { Result, UserInfo } from './types'

export const authApi = {
  register: (data: { username: string; password: string; nickname: string }) =>
    request.post<Result<UserInfo>>('auth/register', data),

  login: (data: { username: string; password: string }) =>
    request.post<Result<string>>('auth/login', data),

  getMe: () => request.get<Result<UserInfo>>('auth/me'),

  getUserById: (id: string) => request.get<Result<UserInfo>>(`auth/info/${id}`),
}
