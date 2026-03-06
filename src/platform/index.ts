import { ElectronProvider } from './providers/electron'
import { WebProvider } from './providers/web'
// import { MobileProvider } from './providers/mobile'

const getPlatform = () => {
  // 1. 检测是否运行在 Electron
  if (typeof window !== 'undefined' && window.electronAPI) {
    return ElectronProvider
  }

  // 2. 检测是否运行在移动端（例如 Capacitor）
  // if (window.Capacitor) {
  //   return MobileProvider
  // }

  // 3. 默认 Web
  return WebProvider
}

export const platform = getPlatform()
