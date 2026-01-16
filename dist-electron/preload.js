"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  sayHello: () => console.log("Hello from Electron Preload!")
});
