import { logger } from '@/utils/logger'
import type { PlatformCapabilities } from '../types'

export const WebProvider: PlatformCapabilities = {
  name: 'web',

  send: (channel, data) => {
    logger.info(`[Web Platform] send event: ${channel}`, data)
  },
  on: (channel, callback) => {
    logger.info(`[Web Platform] subscribe event: ${channel}`, callback)
  },

  app: {
    minimize: () => {
      logger.warn('Web platform does not support minimize')
    },
    maximize: () => {
      logger.warn('Web platform does not support maximize')
    },
    close: () => {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        window.close()
        alert('Please close this browser tab manually')
      }
    },
    exit: () => {
      logger.warn('Web platform does not support direct app exit')
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
        logger.warn('Desktop notification is not supported in current browser')
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

  chatStorage: {
    getConfig: async () => ({
      directory: '',
      globalLimitMB: 256,
      perChatLimitMB: 32,
    }),
    setConfig: async (config) => config,
    chooseDirectory: async () => null,
    readState: async () => null,
    writeState: async () => false,
  },

  device: {
    vibrate: () => {
      if ('vibrate' in navigator) {
        navigator.vibrate(200)
      }
    },
    getBattery: async () => {
      const getBattery = (navigator as Navigator & { getBattery?: () => Promise<{ level: number }> })
        .getBattery
      if (typeof getBattery === 'function') {
        const battery = await getBattery()
        return battery.level * 100
      }
      return 0
    },
  },
}
