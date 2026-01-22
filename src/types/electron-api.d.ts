export interface IElectronAPI {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  send: (channel: string, data?: any) => void
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => void

  log: {
    info: (msg: string, ...args: any[]) => void
    warn: (msg: string, ...args: any[]) => void
    error: (msg: string, ...args: any[]) => void
  }
  /* eslint-enable */

  openLogFolder: () => void
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
