import { app, BrowserWindow, dialog, ipcMain, safeStorage, type OpenDialogOptions } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { logger } from './log.service'
import { storageService } from './stroge.service'

export interface ChatStorageConfig {
  directory: string
  globalLimitMB: number
  perChatLimitMB: number
}

interface ChatStorageWritePayload {
  userId: string
  payload: string
}

const DEFAULT_GLOBAL_LIMIT_MB = 256
const DEFAULT_PER_CHAT_LIMIT_MB = 32

class ChatCacheService {
  constructor() {
    this.registerIpcHandlers()
    logger.info('Chat Cache Service Init.')
  }

  private registerIpcHandlers() {
    ipcMain.handle('chat-storage:get-config', async () => this.getConfig())
    ipcMain.handle('chat-storage:set-config', async (_, config: Partial<ChatStorageConfig>) =>
      this.setConfig(config),
    )
    ipcMain.handle('chat-storage:choose-directory', async () => this.chooseDirectory())
    ipcMain.handle('chat-storage:read-state', async (_, userId: string) => this.readState(userId))
    ipcMain.handle('chat-storage:write-state', async (_, payload: ChatStorageWritePayload) =>
      this.writeState(payload),
    )
  }

  private getDefaultDirectory() {
    return path.join(app.getPath('userData'), 'chat-cache')
  }

  private normalizeConfig(config?: Partial<ChatStorageConfig>): ChatStorageConfig {
    const base = config || {}
    const directory = String(base.directory || '').trim() || this.getDefaultDirectory()
    const globalLimitMB = Math.max(1, Math.floor(Number(base.globalLimitMB || DEFAULT_GLOBAL_LIMIT_MB)))
    const perChatLimitMBRaw = Math.max(
      1,
      Math.floor(Number(base.perChatLimitMB || DEFAULT_PER_CHAT_LIMIT_MB)),
    )
    const perChatLimitMB = Math.min(perChatLimitMBRaw, globalLimitMB)

    return {
      directory,
      globalLimitMB,
      perChatLimitMB,
    }
  }

  private ensureEncryptionAvailable() {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage is not available on current system.')
    }
  }

  private async ensureDirectory(directory: string) {
    await mkdir(directory, { recursive: true })
  }

  private sanitizeUserId(userId: string) {
    const normalized = String(userId || '').trim()
    if (!normalized) {
      throw new Error('Invalid user id for chat cache storage.')
    }
    return normalized.replace(/[^a-zA-Z0-9_-]/g, '_')
  }

  private resolveCacheFilePath(userId: string, config: ChatStorageConfig) {
    const safeUserId = this.sanitizeUserId(userId)
    return path.join(config.directory, `${safeUserId}.coo`)
  }

  private getFocusedWindow() {
    return BrowserWindow.getFocusedWindow()
  }

  async getConfig(): Promise<ChatStorageConfig> {
    const stored = (storageService.get('chatStorage') as ChatStorageConfig | undefined) || {
      directory: '',
      globalLimitMB: DEFAULT_GLOBAL_LIMIT_MB,
      perChatLimitMB: DEFAULT_PER_CHAT_LIMIT_MB,
    }
    const normalized = this.normalizeConfig(stored)

    if (
      stored.directory !== normalized.directory ||
      stored.globalLimitMB !== normalized.globalLimitMB ||
      stored.perChatLimitMB !== normalized.perChatLimitMB
    ) {
      storageService.set('chatStorage', normalized)
    }

    return normalized
  }

  async setConfig(config: Partial<ChatStorageConfig>): Promise<ChatStorageConfig> {
    const current = await this.getConfig()
    const next = this.normalizeConfig({
      ...current,
      ...config,
    })
    await this.ensureDirectory(next.directory)
    storageService.set('chatStorage', next)
    return next
  }

  async chooseDirectory(): Promise<string | null> {
    const config = await this.getConfig()
    const options: OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: config.directory,
      title: 'Select chat storage directory',
    }
    const focusedWindow = this.getFocusedWindow()
    const result = focusedWindow
      ? await dialog.showOpenDialog(focusedWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const selected = result.filePaths[0]
    if (!selected) return null
    await this.ensureDirectory(selected)
    return selected
  }

  async readState(userId: string): Promise<string | null> {
    this.ensureEncryptionAvailable()
    const config = await this.getConfig()
    const filePath = this.resolveCacheFilePath(userId, config)

    let encrypted = ''
    try {
      encrypted = await readFile(filePath, 'utf8')
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'ENOENT') {
        return null
      }
      throw error
    }

    if (!encrypted.trim()) {
      return null
    }

    const buffer = Buffer.from(encrypted, 'base64')
    return safeStorage.decryptString(buffer)
  }

  async writeState(payload: ChatStorageWritePayload): Promise<boolean> {
    this.ensureEncryptionAvailable()
    const config = await this.getConfig()
    await this.ensureDirectory(config.directory)

    const filePath = this.resolveCacheFilePath(payload.userId, config)
    const encrypted = safeStorage.encryptString(payload.payload).toString('base64')
    await writeFile(filePath, encrypted, 'utf8')
    return true
  }
}

export const chatCacheService = new ChatCacheService()
