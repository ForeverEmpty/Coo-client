"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  send: (channel, data) => electron.ipcRenderer.send(channel, data),
  on: (channel, cb) => electron.ipcRenderer.on(channel, (event, ...args) => cb(event, ...args)),
  log: {
    info: (msg, ...args) => electron.ipcRenderer.send("log-to-main", { level: "info", message: msg, args }),
    warn: (msg, ...args) => electron.ipcRenderer.send("log-to-main", { level: "warn", message: msg, args }),
    error: (msg, ...args) => electron.ipcRenderer.send("log-to-main", { level: "error", message: msg, args })
  },
  /* eslint-enable */
  openLogFolder: () => electron.ipcRenderer.send("open-log-folder-request")
});
