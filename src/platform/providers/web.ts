import { logger } from '@/utils/logger'
import type { PlatformCapabilities } from '../types'

export const WebProvider: PlatformCapabilities = {
  name: 'web',

  send: (channel, data) => {
    logger.info(`[Web Platform] 拦截到消息发送请求: ${channel}`, data)
  },

  app: {
    minimize: () => {
      logger.warn('Web端不支持最小化操作')
    },
    maximize: () => {
      logger.warn('Web端不支持最大化操作')
    },
    close: () => {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        window.close()
        alert('请手动关闭浏览器标签页')
      }
    },
    exit: () => {
      logger.warn('Web端不支持直接退出应用')
    },
    setLoginCache: (data) => {
      localStorage.setItem('loginCache', JSON.stringify(data))
    },
    getLoginCache: async () => {
      const cache = localStorage.getItem('loginCache')
      return cache ? JSON.parse(cache) : null
    },
  },

  notification: {
    send: (title, body) => {
      if (!('Notification' in window)) {
        logger.warn('当前浏览器不支持桌面通知')
        return
      }

      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(title, { body })
          }
        })
      }
    },
  },

  storage: {
    set: (key, value) => {
      localStorage.setItem(key, value)
    },
    get: async (key) => {
      return localStorage.getItem(key)
    },
  },

  device: {
    vibrate: () => {
      if ('vibrate' in navigator) {
        navigator.vibrate(200)
      }
    },
    getBattery: async () => {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery()
        return battery.level * 100
      }
      return 0
    },
  },
}
