import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

// 暴露给 Vue 的全局 API
contextBridge.exposeInMainWorld('electronAPI', {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  send: (channel: string, data?: any) => ipcRenderer.send(channel, data),
  on: (channel: string, cb: (event: IpcRendererEvent, ...args: any[]) => void) =>
    ipcRenderer.on(channel, (event, ...args) => cb(event, ...args)),
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),

  log: {
    info: (msg: string, ...args: any[]) =>
      ipcRenderer.send('log-to-main', { level: 'info', message: msg, args }),
    warn: (msg: string, ...args: any[]) =>
      ipcRenderer.send('log-to-main', { level: 'warn', message: msg, args }),
    error: (msg: string, ...args: any[]) =>
      ipcRenderer.send('log-to-main', { level: 'error', message: msg, args }),
  },
  /* eslint-enable */
  openLogFolder: () => ipcRenderer.send('open-log-folder-request'),
  chatStorage: {
    getConfig: () => ipcRenderer.invoke('chat-storage:get-config'),
    setConfig: (config: { directory: string; globalLimitMB: number; perChatLimitMB: number }) =>
      ipcRenderer.invoke('chat-storage:set-config', config),
    chooseDirectory: () => ipcRenderer.invoke('chat-storage:choose-directory'),
    readState: (userId: string) => ipcRenderer.invoke('chat-storage:read-state', userId),
    writeState: (payload: { userId: string; payload: string }) =>
      ipcRenderer.invoke('chat-storage:write-state', payload),
  },
})
