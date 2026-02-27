import { usePlatform } from './usePlatform'

export interface ConfirmDialogOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

export function useDialog() {
  const { isElectron } = usePlatform()

  const confirm = async (options: ConfirmDialogOptions): Promise<boolean> => {
    if (!isElectron || !window.electronAPI) {
      return false
    }

    return window.electronAPI.invoke('dialog:confirm', options)
  }

  return {
    confirm,
  }
}
