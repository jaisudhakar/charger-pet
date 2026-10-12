// Lets the cat window receive which sprite frame to draw.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cat', {
  onCoat: (cb) => ipcRenderer.on('coat', (_e, coat, sprites) => cb(coat, sprites)),
  onFrame: (cb) => ipcRenderer.on('frame', (_e, sprite, frame) => cb(sprite, frame)),
});
