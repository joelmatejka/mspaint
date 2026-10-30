const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("paintDesktop", {
  saveImage: (payload) => ipcRenderer.invoke("paint:save", payload),
  newDocument: () => ipcRenderer.send("paint:new-document"),
  close: () => ipcRenderer.send("paint:close"),
  onCommand: (callback) => {
    if (typeof callback === "function")
      ipcRenderer.on("paint:command", (_event, command) => callback(command));
  },
});
