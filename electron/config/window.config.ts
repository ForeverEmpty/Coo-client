import type { BrowserWindowConstructorOptions } from 'electron'
import path from 'node:path'

export interface IWindowPreset extends Omit<BrowserWindowConstructorOptions, 'parent'> {
  parent?: string
}
const commonOptions: IWindowPreset = {
  show: false,
  webPreferences: {
    preload: path.join(__dirname, './preload.js'),
    nodeIntegration: false,
    contextIsolation: true,
  },
}

export const WindowPresets: Record<string, IWindowPreset> = {
  LOGIN: {
    ...commonOptions,
    width: 380,
    height: 520,
    frame: false, // 无边框
    resizable: false, // 不可缩放
    transparent: true,
    hasShadow: true,
    alwaysOnTop: true, // 登录窗置顶
  },
  MAIN: {
    ...commonOptions,
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: true, // 有边框
    resizable: true,
  },
  SETTINGS: {
    ...commonOptions,
    width: 600,
    height: 450,
    parent: 'MAIN', // 稍后在 Service 里处理父子关系
    modal: true, // 模态窗口
    resizable: false,
  },
}
