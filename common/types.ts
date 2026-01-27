export interface StoreSchema {
  login: {
    username: string
    password?: string
    remember: boolean
  }
  windowState: {
    width: number
    height: number
  }
}
