import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 1. 手动计算当前文件的路径 (兼容 ESM 模式)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 2. 计算项目根目录 (dist-electron 的上一层)
const ROOT = path.join(__dirname, '..')

// 开发环境下，public 目录就在根目录；生产环境下，它会被拷贝到 dist
const PUBLIC_PATH = app.isPackaged ? path.join(ROOT, 'dist') : path.join(ROOT, 'public')

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: path.join(PUBLIC_PATH, 'electron-vite.svg'),
    webPreferences: {
      // 这里的 preload.js 路径要根据 Vite 编译后的名字来 (通常是 preload.mjs 或 preload.js)
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // 开发环境下使用 Vite 服务器地址
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    // 生产环境下加载打包后的 html
    win.loadFile(path.join(ROOT, 'dist', 'index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
