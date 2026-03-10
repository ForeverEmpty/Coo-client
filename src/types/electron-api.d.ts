export interface IElectronAPI {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  send: (channel: string, data?: any) => void
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => void
  invoke: (channel: string, data?: any) => Promise<any>

  log: {
    info: (msg: string, ...args: any[]) => void
    warn: (msg: string, ...args: any[]) => void
    error: (msg: string, ...args: any[]) => void
  }
  /* eslint-enable */

  openLogFolder: () => void

  chatStorage: {
    getConfig: () => Promise<{
      directory: string
      globalLimitMB: number
      perChatLimitMB: number
    }>
    setConfig: (config: {
      directory: string
      globalLimitMB: number
      perChatLimitMB: number
    }) => Promise<{
      directory: string
      globalLimitMB: number
      perChatLimitMB: number
    }>
    chooseDirectory: () => Promise<string | null>
    readState: (userId: string) => Promise<string | null>
    writeState: (payload: { userId: string; payload: string }) => Promise<boolean>
  }
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
