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
    height: 580,
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
    frame: false, // 无边框
    resizable: true,
    hasShadow: true,
  },
  DIALOG: {
    ...commonOptions,
    width: 600,
    height: 450,
    parent: 'MAIN', // 稍后在 Service 里处理父子关系
    modal: true, // 模态窗口
    resizable: false,
  },
  SEARCH_ADD: {
    ...commonOptions,
    width: 600,
    height: 480,
    minWidth: 600,
    minHeight: 480,
    frame: false,
    resizable: true,
    modal: false,
    title: '添加',
  },
  USER_DETAIL: {
    ...commonOptions,
    width: 400,
    height: 600,
    frame: false,
    resizable: false,
  },
  FRIEND_APPLY: {
    ...commonOptions,
    width: 350,
    height: 450,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
  },
}

export const WindowUrls: Record<string, string> = {
  LOGIN: '/auth/login',
  MAIN: '/',
  SEARCH_ADD: '/contacts/add',
  FRIEND_APPLY: '/contacts/apply',
}
