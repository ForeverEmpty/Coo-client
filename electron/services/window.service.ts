import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import path from 'node:path'

import { WindowPresets } from '@/electron/config/window.config'
import { WindowType } from '@/common/enum'
import { logger } from './log.service'

export class WindowService {
  private windowMap: Map<WindowType, BrowserWindow> = new Map()

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
