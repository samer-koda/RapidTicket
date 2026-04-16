const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Suppress harmless DevTools protocol errors for unimplemented Autofill commands
app.commandLine.appendSwitch('disable-features', 'AutofillEnableAccountStorageForIneligibleCountries');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ── Config helpers ────────────────────────────────────────────────────────────

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeConfig(data) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

// ── Window ────────────────────────────────────────────────────────────────────

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1E1E1E',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC handlers ──────────────────────────────────────────────────────────────

// Config read/write
ipcMain.handle('config:read', () => readConfig());
ipcMain.handle('config:write', (_event, data) => {
  writeConfig(data);
  return true;
});

// Get station MAC address
ipcMain.handle('system:mac', () => {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface || []) {
      if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
        return addr.mac;
      }
    }
  }
  return null;
});

// Get OS printers (returns empty array in dev; Electron exposes this via webContents.getPrintersAsync)
ipcMain.handle('print:list', async () => {
  try {
    const printers = await win.webContents.getPrintersAsync();
    return printers.map(p => ({ name: p.name, isDefault: p.isDefault }));
  } catch {
    return [];
  }
});

// Print raw ESC/POS or trigger window print dialog
ipcMain.handle('print:receipt', async (_event, html) => {
  const printWin = new BrowserWindow({ show: false });
  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return new Promise((resolve) => {
    printWin.webContents.print({ silent: false, printBackground: true }, (success) => {
      printWin.close();
      resolve(success);
    });
  });
});
