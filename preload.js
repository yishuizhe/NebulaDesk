const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nebulaDesk', {
  platform: process.platform,
  isMac: process.platform === 'darwin',
  windowControl: (action) => ipcRenderer.invoke('window-control', action),
  exportPng: (payload) => ipcRenderer.invoke('export-png', payload || {}),
  savePreset: (preset) => ipcRenderer.invoke('save-preset', preset || {}),
  loadPreset: () => ipcRenderer.invoke('load-preset'),
  copyText: (text) => ipcRenderer.invoke('copy-text', text || ''),
  startWallpaper: (state) => ipcRenderer.invoke('start-wallpaper', state || {}),
  stopWallpaper: () => ipcRenderer.invoke('stop-wallpaper'),
  updateWallpaper: (state) => ipcRenderer.invoke('wallpaper-update', state || {}),
  onWallpaperState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state || {});
    ipcRenderer.on('wallpaper-state', listener);
    return () => ipcRenderer.removeListener('wallpaper-state', listener);
  },
});
