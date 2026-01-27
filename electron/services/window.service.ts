import { BrowserWindow, ipcMain } from 'electron'
import type { BrowserWindowConstructorOptions, IpcMainEvent } from 'electron'
import path from 'node:path'

import { WindowPresets, WindowUrls } from '@/electron/config/window.config'
import { WindowType } from '@/common/enum'
import { logger } from './log.service'

export class WindowService {
  private windowMap: Map<WindowType, BrowserWindow> = new Map()

  constructor() {
    this.registerIpcHandlers()
    logger.info('Window Service Init.')
  }

  private registerIpcHandlers() {
    // 1. 最小化
    ipcMain.on('window-minimize', (event: IpcMainEvent) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      win?.minimize()
    })

    // 2. 最大化/还原 切换
    ipcMain.on('window-maximize', (event: IpcMainEvent) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        if (win.isMaximized()) {
          win.unmaximize()
        } else {
          win.maximize()
        }
      }
    })

    // 3. 关闭窗口
    ipcMain.on('window-close', (event: IpcMainEvent) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      win?.close()
    })

    // 4. 隐藏窗口
    ipcMain.on('window-hide', (event: IpcMainEvent) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      win?.hide()
    })

    logger.info('Window IPC Init.')
  }

  createWindow(
    type: WindowType,
    routePath: string = '',
    customOptions?: BrowserWindowConstructorOptions,
  ) {
    if (this.windowMap.has(type)) {
      const existingWin = this.windowMap.get(type)
      existingWin?.focus()
      return existingWin
    }

    const preset = WindowPresets[type]
    if (!preset) {
      logger.error(`Cannot find window preset: ${type}`)
      return
    }

    const finalOptions = { ...preset, ...customOptions }

    if (preset.parent && typeof preset.parent === 'string') {
      const parentWin = this.windowMap.get(preset.parent as WindowType)

      if (parentWin) {
        finalOptions.parent = parentWin
      } else {
        delete finalOptions.parent
        logger.warn(`Parent window ${preset.parent} not created, skip setting parent`)
      }
    }

    const win = new BrowserWindow(finalOptions as BrowserWindowConstructorOptions)

    if (routePath === '') {
      routePath = WindowUrls[type] || ''
    }

    routePath = routePath.replace(/^\/+/, '')

    const url = process.env.VITE_DEV_SERVER_URL
      ? `${process.env.VITE_DEV_SERVER_URL}${routePath}`
      : `file://${path.join(__dirname, '../renderer/index.html')}${routePath}`

    win.loadURL(url)

    win.once('ready-to-show', () => {
      win.show()
      logger.info(`Window ${type} is ready to show`)
    })

    win.on('closed', () => {
      this.windowMap.delete(type)
      logger.info(`Window ${type} is closed`)
    })

    this.windowMap.set(type, win)
    return win
  }

  get(type: WindowType) {
    return this.windowMap.get(type)
  }

  close(type: WindowType) {
    const win = this.windowMap.get(type)
    if (win) {
      win.close()
    }
  }

  closeAll() {
    this.windowMap.forEach((win) => win.close())
  }

  closeFilter(filter: (type: WindowType) => boolean) {
    this.windowMap.forEach((win, type) => {
      if (filter(type)) {
        win.close()
      }
    })
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  send(type: WindowType, channel: string, data: any) {
    const win = this.windowMap.get(type)
    if (win) {
      win.webContents.send(channel, data)
    }
  }
  /* eslint-enable */
}

export const windowService = new WindowService()
