import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authApi } from '@/api/auth'
import type { UserInfo } from '@/api/types'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('coo_token') || '')
  const userInfo = ref<UserInfo | null>(
    localStorage.getItem('coo_user_info')
      ? JSON.parse(localStorage.getItem('coo_user_info') as string)
      : null,
  )

  const login = async (newToken: string) => {
    token.value = newToken
    localStorage.setItem('coo_token', newToken)
    await fetchUserInfo()
  }

  const logout = () => {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('coo_token')
    localStorage.removeItem('coo_user_info')
  }

  const fetchUserInfo = async () => {
    try {
      if (!token.value) return
      const res = await authApi.getMe()
      if (res.code === 200) {
        userInfo.value = res.data
        localStorage.setItem('coo_user_info', JSON.stringify(res.data))
      }
    } catch (error) {
      console.error('Fetch user info failed', error)
    }
  }

  if (token.value) {
    fetchUserInfo()
  }

  return {
    token,
    userInfo,
    login,
    logout,
    fetchUserInfo,
  }
})
