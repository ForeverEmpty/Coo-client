import log from 'electron-log'
import path from 'node:path'
import { app, shell } from 'electron'

export class LogService {
  constructor() {
    log.transports.console.level = app.isPackaged ? 'info' : 'debug'
    log.transports.file.level = 'info'
    log.transports.file.maxSize = 1024 * 1024 * 10 // 10MB

    const logFolder = app.isPackaged
      ? path.join(app.getPath('userData'), 'logs')
      : path.join(process.cwd(), 'logs')

    log.transports.file.resolvePathFn = () => path.join(logFolder, 'main.log')

    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'

    log.initialize()

    log.info('Log Service Init.')
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  debug(message: string, ...args: any[]) {
    log.debug(message, ...args)
  }

  info(message: string, ...args: any[]) {
    log.info(message, ...args)
  }

  warn(message: string, ...args: any[]) {
    log.warn(message, ...args)
  }

  error(message: string, ...args: any[]) {
    log.error(message, ...args)
  }
  /* eslint-enable */

  openLogFolder() {
    const logPath = log.transports.file.getFile().path
    shell.showItemInFolder(logPath)
  }
}

export const logger = new LogService()
