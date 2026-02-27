import { ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'

import { WindowType } from '@/common/enum'
import { windowService } from './window.service'
import { logger } from './log.service'

export interface ConfirmDialogOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

interface DialogResolvePayload {
  dialogId: string
  result: boolean
}

export class DialogService {
  private pendingResolves = new Map<string, (value: boolean) => void>()

  constructor() {
    this.registerIpcHandlers()
    logger.info('Dialog Service Init.')
  }

  private registerIpcHandlers() {
    ipcMain.handle('dialog:confirm', (_, payload: ConfirmDialogOptions) => {
      return this.openConfirmDialog(payload)
    })

    ipcMain.on('dialog:resolve', (_, payload: DialogResolvePayload) => {
      this.resolveDialog(payload.dialogId, payload.result)
    })
  }

  private openConfirmDialog(payload: ConfirmDialogOptions): Promise<boolean> {
    const dialogId = randomUUID()
    const serializedPayload = encodeURIComponent(JSON.stringify(payload))
    const route = `/dialog?scene=confirm&dialogId=${dialogId}&payload=${serializedPayload}`

    const dialogWindow = windowService.createWindow(WindowType.DIALOG, route, undefined, true)
    if (!dialogWindow) {
      return Promise.resolve(false)
    }

    return new Promise<boolean>((resolve) => {
      this.pendingResolves.set(dialogId, resolve)

      dialogWindow.once('closed', () => {
        this.resolveDialog(dialogId, false, false)
      })
    })
  }

  private resolveDialog(dialogId: string, result: boolean, closeWindow = true) {
    const resolve = this.pendingResolves.get(dialogId)
    if (!resolve) {
      return
    }

    this.pendingResolves.delete(dialogId)
    resolve(result)

    if (closeWindow) {
      windowService.close(WindowType.DIALOG)
    }
  }
}

export const dialogService = new DialogService()
