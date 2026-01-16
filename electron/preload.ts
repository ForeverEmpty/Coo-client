import { contextBridge } from 'electron'

// 暴露给 Vue 的全局 API
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  sayHello: () => console.log('Hello from Electron Preload!')
})
