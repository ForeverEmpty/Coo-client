import type { PlatformCapabilities } from '../types'

export const ElectronProvider: PlatformCapabilities = {
  name: 'electron',

  send: (channel, data) => window.electronAPI?.send(channel, data),

  app: {
    minimize: () => window.electronAPI?.send('window-minimize'),
    maximize: () => window.electronAPI?.send('window-maximize'),
    close: () => window.electronAPI?.send('window-close'),
    exit: () => window.electronAPI?.send('app-exit'),
    setLoginCache: (data) => window.electronAPI.send('set-login-cache', data),
    getLoginCache: () => window.electronAPI.invoke('get-login-cache'),
  },

  notification: {
    send: (title, body) => new Notification(title, { body }),
  },

  storage: {
    set: (key, value) => localStorage.setItem(key, value),
    get: async (key) => localStorage.getItem(key),
  },

  device: {
    vibrate: () => {}, // 电脑不会震动
    getBattery: async () => 0,
  },
}
