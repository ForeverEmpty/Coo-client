import axios from 'axios'
import { requestObserver } from './requestObserver'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 5000,
})

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

    if (res.code === 401) {
      requestObserver.emit('UNAUTHORIZED', { message: res.msg, code: res.code })
    } else {
      requestObserver.emit('ERROR', { message: res.message, code: res.code })
    }
    return Promise.reject(new Error(res.message))
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      requestObserver.emit('TIMEOUT', { message: 'Timeout', config: error.config })
    } else {
      requestObserver.emit('ERROR', { message: error.message })
    }
    return Promise.reject(error)
  },
)

export default request
