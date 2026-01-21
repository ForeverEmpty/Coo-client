import { platform } from '@/platform'

export function usePlatform() {
  return {
    p: platform,
    isElectron: platform.name === 'electron',
    isWeb: platform.name === 'web',
    isMobile: platform.name === 'mobile',
  }
}
