export interface PlatformCapabilities {
  name: 'web' | 'electron' | 'mobile'

  /* eslint-disable @typescript-eslint/no-explicit-any */
  send: (channel: string, data?: any) => void
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => void
  /* eslint-enable */

  app: {
    minimize(): void
    maximize(): void
    close(): void
    exit(): void
    setLoginCache(data: { username: string; password?: string; remember: boolean }): void
    getLoginCache(): Promise<{ username: string; password?: string } | null>
  }

  notification: {
    send(title: string, body: string): void
  }

  storage: {
    set(key: string, value: string): void
    get(key: string): Promise<string | null>
  }

  device: {
    vibrate(): void // 移动端震动，Web/桌面忽略
    getBattery(): Promise<number>
  }
}
