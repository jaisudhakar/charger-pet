// Bridge between the Electron main process and the pages (tray renderer + pet window).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chargerPetDesktop', {
  platform: process.platform,
  frame: (dataUrl) => ipcRenderer.send('pet:frame', dataUrl),
  battery: (state) => ipcRenderer.send('pet:battery', state),
  heroes: (list) => ipcRenderer.send('pet:heroes', list),
  heroChanged: (id) => ipcRenderer.send('pet:hero-changed', id),
  hidePopup: () => ipcRenderer.send('pet:hide-popup'),
  onSetHero: (cb) => ipcRenderer.on('pet:set-hero', (_e, id) => cb(id)),
  onTheme: (cb) => ipcRenderer.on('pet:theme', (_e, dark) => cb(dark)),
});
