import { ElectronProvider } from './providers/electron'
import { WebProvider } from './providers/web'
//import { MobileProvider } from './providers/mobile';

const getPlatform = () => {
  // 1. 探测是否为 Electron
  if (typeof window !== 'undefined' && window.electronAPI) {
    return ElectronProvider
  }

  // 2. 探测是否为移动端 (比如检查是否有 Capacitor 注入的对象)
  //if (window.Capacitor) {
  //  return MobileProvider;
  //}

  // 3. 默认为 Web
  return WebProvider
}

export const platform = getPlatform()
