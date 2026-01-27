import request from '@/utils/request'
import type { EditProfileData, PrivacySettings, Result, UserInfo } from './types'

export const authApi = {
  register: (data: { username: string; password: string; nickname: string }) =>
    request.post<Result<string>>('auth/register', data),

  login: (data: { username: string; password: string }) =>
    request.post<Result<string>>('auth/login', data),

  getMe: () => request.get<Result<UserInfo>>('auth/me'),

  getUserById: (id: string) => request.get<Result<UserInfo>>(`auth/info/${id}`),

  updateAvatar: (url: string) => request.post<Result<string>>('auth/avatar/update', { url }),

  updateBackground: (url: string) => request.post<Result<string>>('auth/background/update', { url }),

  updatePrivacy: (settings: PrivacySettings) => request.post<Result<string>>('auth/privacy/update', settings),

  updateProfile: (data: EditProfileData) => request.post<Result<string>>('auth/profile/update', data),
}
