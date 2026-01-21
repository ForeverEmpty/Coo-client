export interface PlatformCapabilities {
  name: 'web' | 'electron' | 'mobile'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send: (channel: string, data?: any) => void

  app: {
    minimize(): void
    close(): void
    exit(): void
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
