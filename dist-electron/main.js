"use strict";
const electron = require("electron");
const path = require("node:path");
const node_url = require("node:url");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
const __filename$1 = node_url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("main.js", document.baseURI).href);
const __dirname$1 = path.dirname(__filename$1);
const ROOT = path.join(__dirname$1, "..");
const PUBLIC_PATH = electron.app.isPackaged ? path.join(ROOT, "dist") : path.join(ROOT, "public");
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1e3,
    height: 800,
    icon: path.join(PUBLIC_PATH, "electron-vite.svg"),
    webPreferences: {
      // 这里的 preload.js 路径要根据 Vite 编译后的名字来 (通常是 preload.mjs 或 preload.js)
      preload: path.join(__dirname$1, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(ROOT, "dist", "index.html"));
  }
}
electron.app.whenReady().then(createWindow);
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
