import type { StoreSchema } from '@/common/types'
import { safeStorage } from 'electron'
import Store from 'electron-store'
import { logger } from './log.service'

const store = new Store<StoreSchema>({
  name: 'coo-config',
  fileExtension: 'json',
  defaults: {
    login: {
      username: '',
      password: '',
      remember: false,
    },
    windowState: {
      width: 1200,
      height: 800,
    },
  },
})

export const storageService = {
  saveLogin(username: string, password?: string, remember: boolean = false) {
    let encryptedPassword = ''

    if (password && safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = safeStorage.encryptString(password)
        encryptedPassword = buffer.toString('hex')
      } catch (error) {
        logger.error('Encrypt password failed:', error)
      }
    }

    store.set('login', {
      username,
      password: remember ? encryptedPassword : '',
      remember,
    })
  },

  getLogin() {
    const data = store.get('login')
    let plainPassword = ''

    if (data.password && safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = Buffer.from(data.password, 'hex')
        plainPassword = safeStorage.decryptString(buffer)
      } catch (error) {
        logger.error('Decrypt password failed:', error)
      }
    }

    return {
      username: data.username,
      password: plainPassword,
      remember: data.remember,
    }
  },

  get(key: keyof StoreSchema) {
    return store.get(key)
  },

  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]) {
    store.set(key, value)
  },
}
