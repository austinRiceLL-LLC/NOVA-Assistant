/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("atlasDesktop", {
  isNative: true,
  setSurface(surface) { if (["edge", "brief", "workspace"].includes(surface)) ipcRenderer.send("atlas:set-surface", surface); },
  getConfig() { return ipcRenderer.invoke("atlas:get-config"); },
  onSurface(callback) {
    const listener = (_event, surface) => callback(surface);
    ipcRenderer.on("atlas:native-surface", listener);
    return () => ipcRenderer.removeListener("atlas:native-surface", listener);
  },
});
