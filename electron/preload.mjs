import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("maruDesktop", {
  getEnvironment: () => ipcRenderer.invoke("maru-desktop:get-environment"),
  openExternal: (url) => ipcRenderer.invoke("maru-desktop:open-external", url),
  windowControls: {
    minimize: () => ipcRenderer.invoke("maru-desktop:window-action", "minimize"),
    toggleMaximize: () =>
      ipcRenderer.invoke("maru-desktop:window-action", "toggle-maximize"),
    close: () => ipcRenderer.invoke("maru-desktop:window-action", "close"),
  },
  updater: {
    check: () => ipcRenderer.invoke("updater:check"),
    download: () => ipcRenderer.invoke("updater:download"),
    isSupported: () => ipcRenderer.invoke("updater:is-supported"),
    onStatus: (callback) => {
      ipcRenderer.on("update:status", (_event, status) => callback(status));
    },
  },
});
