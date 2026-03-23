import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { requestObserver } from './requestObserver'

// 扩展 axios 配置类型
declare module 'axios' {
  export interface AxiosRequestConfig {
    skipErrorHandler?: boolean
  }
}

interface TypedAxiosInstance extends AxiosInstance {
  request<T = unknown>(config: AxiosRequestConfig): Promise<T>
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  head<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  options<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
}

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 5000,
}) as TypedAxiosInstance

const hasAuthToken = () => Boolean(localStorage.getItem('coo_token'))

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('coo_token')

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

request.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code === 200) return res

    if (response.config.skipErrorHandler) {
      return Promise.reject(new Error(res.message))
    }

    if (res.code === 401) {
      if (!hasAuthToken()) {
        return Promise.reject(new Error(res.message || 'Unauthorized'))
      }
      requestObserver.emit('UNAUTHORIZED', { message: res.message, code: res.code })
    } else {
      requestObserver.emit('ERROR', { message: res.message, code: res.code })
    }
    return Promise.reject(new Error(res.message))
  },
  (error) => {
    if (error.config?.skipErrorHandler) {
      return Promise.reject(error)
    }

    if (error.code === 'ECONNABORTED') {
      requestObserver.emit('TIMEOUT', { message: 'Timeout', config: error.config })
    } else if (error.response?.status === 401) {
      if (hasAuthToken()) {
        requestObserver.emit('UNAUTHORIZED', {
          message: error.response?.data?.message || error.message || 'Unauthorized',
          code: 401,
          config: error.config,
        })
      }
    } else {
      requestObserver.emit('ERROR', {
        message: error.response?.data?.message || error.message,
        code: error.response?.status,
        config: error.config,
      })
    }
    return Promise.reject(error)
  },
)

export default request
