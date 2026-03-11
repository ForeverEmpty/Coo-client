import request from '@/utils/request'
import type { EditProfileData, PrivacySettings, Result, UserInfo } from './types'
import type { AxiosProgressEvent, AxiosRequestConfig } from 'axios'

export const authApi = {
  register: (data: { username: string; password: string; nickname: string }) =>
    request.post<Result<string>>('auth/register', data),

  login: (data: { username: string; password: string }) =>
    request.post<Result<string>>('auth/login', data),

  getMe: () => request.get<Result<UserInfo>>('auth/me'),

  getUserById: (id: string) => request.get<Result<UserInfo>>(`auth/info/${id}`),

  updateAvatar: (url: string) => request.post<Result<string>>('auth/avatar/update', { avatar: url }),

  updateBackground: (url: string) =>
    request.post<Result<string>>('auth/background/update', { background: url }),

  uploadProfileFile: (
    file: File,
    onProgress?: (progress: number) => void,
    config?: AxiosRequestConfig,
  ) => {
    const formData = new FormData()
    formData.append('file', file)
    return request.post<Result<string>>('auth/file/upload', formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config?.headers,
      },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress?.(percentCompleted)
        }
      },
    })
  },

  updatePrivacy: (settings: PrivacySettings) => request.post<Result<string>>('auth/privacy/update', settings),

  updateProfile: (data: EditProfileData) => request.post<Result<string>>('auth/profile/update', data),
}
