/* eslint-disable @typescript-eslint/no-explicit-any */
export const logger = {
  info: (msg: string, ...args: any[]) => {
    console.log(msg, ...args)
    if (window.electronAPI) window.electronAPI.log.info(msg, ...args)
  },
  warn: (msg: string, ...args: any[]) => {
    console.warn(msg, ...args)
    if (window.electronAPI) window.electronAPI.log.warn(msg, ...args)
  },
  error: (msg: string, ...args: any[]) => {
    console.error(msg, ...args)
    if (window.electronAPI) window.electronAPI.log.error(msg, ...args)
  },
}
