const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Menu, screen } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_NAME = 'NebulaDesk';
const APP_ID = 'com.yishuizhe.nebuladesk';
const INDEX_FILE = path.join(__dirname, 'app', 'index.html');

let mainWindow = null;
let wallpaperWindow = null;
let wallpaperState = null;
let isQuitting = false;

function appUrl(params = {}) {
  const url = new URL(`file://${INDEX_FILE}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
}

function isSafeExternalUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['https:', 'http:', 'mailto:'].includes(url.protocol);
  } catch (_) {
    return false;
  }
}

function openExternal(value) {
  if (!isSafeExternalUrl(value)) return;
  shell.openExternal(String(value)).catch(() => {});
}

function sendWallpaperState() {
  if (!wallpaperWindow || wallpaperWindow.isDestroyed()) return;
  wallpaperWindow.webContents.send('wallpaper-state', wallpaperState || {});
}

function createAppMenu() {
  if (process.platform !== 'darwin') return;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: APP_NAME,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 780,
    minWidth: 980,
    minHeight: 640,
    show: false,
    frame: process.platform === 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 20, y: 18 } : undefined,
    backgroundColor: '#05070b',
    title: APP_NAME,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) return;
    event.preventDefault();
    openExternal(url);
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (!isQuitting) closeWallpaperWindow();
  });

  mainWindow.loadURL(appUrl()).catch((err) => console.error('NebulaDesk load failed:', err));
}

function createWallpaperWindow(state) {
  wallpaperState = state || wallpaperState || {};
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
    sendWallpaperState();
    wallpaperWindow.showInactive();
    return;
  }

  const display = screen.getPrimaryDisplay();
  wallpaperWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    title: 'NebulaDesk Wallpaper',
    backgroundColor: '#02030a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  wallpaperWindow.setIgnoreMouseEvents(true, { forward: true });
  try {
    wallpaperWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (process.platform === 'darwin') wallpaperWindow.moveBottom();
  } catch (_) {}

  wallpaperWindow.webContents.once('did-finish-load', sendWallpaperState);
  wallpaperWindow.once('ready-to-show', () => {
    if (!wallpaperWindow || wallpaperWindow.isDestroyed()) return;
    wallpaperWindow.showInactive();
    try {
      if (process.platform === 'darwin') wallpaperWindow.moveBottom();
    } catch (_) {}
    sendWallpaperState();
  });
  wallpaperWindow.on('closed', () => {
    wallpaperWindow = null;
  });

  wallpaperWindow.loadURL(appUrl({ wallpaper: '1' })).catch((err) => console.error('Wallpaper load failed:', err));
}

function closeWallpaperWindow() {
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) wallpaperWindow.close();
  wallpaperWindow = null;
}

ipcMain.handle('window-control', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  if (action === 'minimize') win.minimize();
  if (action === 'maximize') {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
  if (action === 'close') win.close();
});

ipcMain.handle('export-png', async (event, payload) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const dataUrl = String(payload && payload.dataUrl || '');
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return { ok: false, error: 'INVALID_PNG_DATA' };
  const result = await dialog.showSaveDialog(owner || undefined, {
    title: 'Export Nebula PNG',
    defaultPath: `${payload.fileName || 'nebuladesk-scene'}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(result.filePath, Buffer.from(match[1], 'base64'));
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle('save-preset', async (event, preset) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const safeName = String(preset && preset.slug || 'nebula-preset').replace(/[^a-z0-9_.-]+/gi, '-');
  const result = await dialog.showSaveDialog(owner || undefined, {
    title: 'Save NebulaDesk Preset',
    defaultPath: `${safeName}.nebula.json`,
    filters: [{ name: 'NebulaDesk Preset', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(result.filePath, JSON.stringify(preset || {}, null, 2), 'utf8');
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle('load-preset', async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(owner || undefined, {
    title: 'Load NebulaDesk Preset',
    properties: ['openFile'],
    filters: [{ name: 'NebulaDesk Preset', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
  const text = fs.readFileSync(result.filePaths[0], 'utf8');
  return { ok: true, preset: JSON.parse(text), filePath: result.filePaths[0] };
});

ipcMain.handle('copy-text', (_event, text) => {
  clipboard.writeText(String(text || ''));
  return { ok: true };
});

ipcMain.handle('start-wallpaper', (_event, state) => {
  createWallpaperWindow(state || {});
  return { ok: true };
});

ipcMain.handle('stop-wallpaper', () => {
  closeWallpaperWindow();
  return { ok: true };
});

ipcMain.handle('wallpaper-update', (_event, state) => {
  wallpaperState = state || {};
  sendWallpaperState();
  return { ok: true };
});

app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

app.whenReady().then(() => {
  createAppMenu();
  createMainWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
