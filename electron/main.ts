import { app, BrowserWindow, ipcMain } from 'electron'

import { logger } from './services/log.service'
import { windowService } from './services/window.service'
import { WindowType } from '@/common/enum'

ipcMain.on('log-to-main', (_, { level, message, args }) => {
  const prefix = `[Renderer] `
  switch (level) {
    case 'info':
      logger.info(prefix + message, ...args)
      break
    case 'warn':
      logger.warn(prefix + message, ...args)
      break
    case 'error':
      logger.error(prefix + message, ...args)
      break
    default:
      logger.debug(prefix + message, ...args)
  }
})

app.whenReady().then(() => {
  logger.info('App is ready, creating login window...')

  windowService.createWindow(WindowType.LOGIN, '/auth/login')

  // 如果是 macOS，当图标被点击且没有窗口时重新创建
  app.on('activate', () => {
    if (app.getAppMetrics().length === 0) {
      windowService.createWindow(WindowType.LOGIN, '/auth/login')
    }
  })
})

ipcMain.on('login-success', () => {
  windowService.createWindow(WindowType.MAIN, '')
  windowService.close(WindowType.LOGIN)
})

// 最小化窗口
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})

// 关闭窗口
ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})

ipcMain.on('re-login', () => {
  windowService.createWindow(WindowType.LOGIN, '/auth/login')
  windowService.closeFilter((type) => type !== WindowType.LOGIN)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
