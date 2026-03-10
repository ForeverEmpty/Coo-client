import type { PlatformCapabilities } from '../types'

export const ElectronProvider: PlatformCapabilities = {
  name: 'electron',

  send: (channel, data) => window.electronAPI?.send(channel, data),
  on: (channel, callback) => window.electronAPI?.on(channel, callback),

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

  chatStorage: {
    getConfig: () => window.electronAPI.chatStorage.getConfig(),
    setConfig: (config) => window.electronAPI.chatStorage.setConfig(config),
    chooseDirectory: () => window.electronAPI.chatStorage.chooseDirectory(),
    readState: (userId) => window.electronAPI.chatStorage.readState(userId),
    writeState: (payload) => window.electronAPI.chatStorage.writeState(payload),
  },

  device: {
    vibrate: () => {}, // 电脑不会震动
    getBattery: async () => 0,
  },
}
