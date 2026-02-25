import type { AxiosProgressEvent, AxiosRequestConfig } from 'axios'
import request from '@/utils/request'
import type { Result } from './types'

export const fileApi = {
  upload: (
    file: File,
    onProgress?: (progress: number) => void,
    config?: AxiosRequestConfig,
  ) => {
    const formData = new FormData()
    formData.append('file', file)
    return request.post<Result<string>>('/file/upload', formData, {
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
}
