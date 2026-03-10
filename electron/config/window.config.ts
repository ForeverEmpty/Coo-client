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
    frame: false,
    resizable: false,
    transparent: true,
    hasShadow: true,
    alwaysOnTop: true,
  },
  MAIN: {
    ...commonOptions,
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    resizable: true,
    hasShadow: true,
  },
  DIALOG: {
    ...commonOptions,
    width: 520,
    height: 320,
    minWidth: 480,
    minHeight: 300,
    frame: false,
    parent: 'MAIN',
    modal: true,
    resizable: false,
    hasShadow: true,
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
  GROUP_MANAGE: {
    ...commonOptions,
    width: 400,
    height: 500,
    frame: false,
    resizable: false,
    modal: true,
  },
  ACCEPT_APPLY: {
    ...commonOptions,
    width: 400,
    height: 420,
    frame: false,
    resizable: false,
    modal: true,
  },
  IMAGE_EDITOR: {
    ...commonOptions,
    width: 760,
    height: 620,
    minWidth: 680,
    minHeight: 560,
    frame: false,
    resizable: true,
    hasShadow: true,
  },
}

export const WindowUrls: Record<string, string> = {
  LOGIN: '/auth/login',
  MAIN: '/',
  DIALOG: '/dialog',
  SEARCH_ADD: '/contacts/add',
  FRIEND_APPLY: '/contacts/apply',
  GROUP_MANAGE: '/contacts/group-manage',
  ACCEPT_APPLY: '/contacts/accept-apply',
  IMAGE_EDITOR: '/profile/image-editor',
}
