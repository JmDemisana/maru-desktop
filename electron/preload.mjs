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

contextBridge.exposeInMainWorld("marucast", {
  getQr: (token, siteOrigin) => ipcRenderer.invoke("marucast:get-qr", token, siteOrigin),
  startDiscovery: () => ipcRenderer.invoke("marucast:start-discovery"),
  stopDiscovery: () => ipcRenderer.invoke("marucast:stop-discovery"),
  connect: (host, port, name, code) =>
    ipcRenderer.invoke("marucast:connect", host, port, name, code),
  disconnect: () => ipcRenderer.invoke("marucast:disconnect"),
  setVolume: (vol) => ipcRenderer.invoke("marucast:set-volume", vol),
  getStatus: () => ipcRenderer.invoke("marucast:get-status"),
  getSenders: () => ipcRenderer.invoke("marucast:get-senders"),
  onPcm: (callback) => {
    ipcRenderer.on("marucast:pcm", (_event, chunk) => callback(chunk));
  },
  onSenders: (callback) => {
    ipcRenderer.on("marucast:senders", (_event, senders) => callback(senders));
  },
  onStatus: (callback) => {
    ipcRenderer.on("marucast:status", (_event, status) => callback(status));
  },
});
