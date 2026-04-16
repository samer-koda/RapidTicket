const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  config: {
    read: () => ipcRenderer.invoke('config:read'),
    write: (data) => ipcRenderer.invoke('config:write', data),
  },
  system: {
    mac: () => ipcRenderer.invoke('system:mac'),
    listPrinters: () => ipcRenderer.invoke('print:list'),
  },
  print: {
    receipt: (html) => ipcRenderer.invoke('print:receipt', html),
  },
});
