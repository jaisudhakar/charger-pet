// Charger Pet desktop app: an animated 3D pet that lives in the system tray / top bar
// next to the battery icon (Windows, macOS, Ubuntu/Linux), plus a pop-up 3D scene that
// appears when the charger is connected.
import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, protocol, net, screen, nativeTheme } from 'electron';
import { join, dirname, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PRELOAD = join(ROOT, 'desktop', 'preload.cjs');
const ORIGIN = 'app://pet';
const POPUP_W = 380;
const POPUP_H = 600;

// Tray icon geometry per platform: rendered pixels, scale factor and frame rate.
const ICON = {
  darwin: { size: 44, scale: 2, fps: 10 },
  win32: { size: 32, scale: 2, fps: 10 },
  linux: { size: 44, scale: 1, fps: 8 },
}[process.platform] ?? { size: 44, scale: 1, fps: 8 };

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

// If the GPU is blocklisted (common with old Linux/Windows drivers), let WebGL fall back
// to software rendering. Only our own local pages are ever loaded.
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

if (!app.requestSingleInstanceLock()) app.quit();

// ------------------------------------------------------------------ settings
const settingsFile = () => join(app.getPath('userData'), 'settings.json');
const settings = { hero: 'volt', popupOnPlug: true, transformOnPlug: true, openAtLogin: false };
function loadSettings() {
  try {
    Object.assign(settings, JSON.parse(fs.readFileSync(settingsFile(), 'utf8')));
  } catch {}
}
function saveSettings() {
  try {
    fs.mkdirSync(dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  } catch {}
}

// ------------------------------------------------------------------ state
let tray = null;
let spriteWin = null;
let popup = null;
let popupAutoHide = null;
let heroes = [];
const battery = { level: 1, charging: false, known: false };

function heroName(id) {
  return heroes.find((h) => h.id === id)?.name ?? 'Charger Pet';
}

function statusText() {
  if (!battery.known) return 'Reading battery…';
  const pct = Math.round(battery.level * 100);
  if (battery.charging) return battery.level >= 0.995 ? `${pct}% · Fully charged` : `${pct}% · Charging`;
  return battery.level < 0.2 ? `${pct}% · Low battery` : `${pct}% · On battery`;
}

// ------------------------------------------------------------------ windows
function createSpriteWindow() {
  spriteWin = new BrowserWindow({
    show: false,
    width: 120,
    height: 120,
    skipTaskbar: true,
    webPreferences: { preload: PRELOAD, backgroundThrottling: false },
  });
  const q = new URLSearchParams({
    size: String(ICON.size),
    fps: String(ICON.fps),
    hero: settings.hero,
    dark: process.platform === 'linux' || nativeTheme.shouldUseDarkColors ? '1' : '0',
  });
  spriteWin.loadURL(`${ORIGIN}/desktop/tray.html?${q}`);
}

function createPopup() {
  popup = new BrowserWindow({
    width: POPUP_W,
    height: POPUP_H,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#04060f',
    title: 'Charger Pet',
    webPreferences: { preload: PRELOAD },
  });
  popup.loadURL(`${ORIGIN}/index.html`);
  popup.webContents.on('did-finish-load', () => popup.webContents.send('pet:set-hero', settings.hero));
  popup.on('blur', () => {
    if (!popupAutoHide && !popup.webContents.isDevToolsOpened()) popup.hide();
  });
  popup.on('focus', () => {
    clearTimeout(popupAutoHide);
    popupAutoHide = null;
  });
  popup.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      popup.hide();
    }
  });
}

function positionPopup() {
  const b = tray?.getBounds?.() ?? { x: 0, y: 0, width: 0, height: 0 };
  const display = b.width ? screen.getDisplayMatching(b) : screen.getPrimaryDisplay();
  const wa = display.workArea;
  let x;
  let y;
  if (b.width) {
    x = Math.round(b.x + b.width / 2 - POPUP_W / 2);
    const below = b.y < display.bounds.y + display.bounds.height / 2;
    y = below ? b.y + b.height + 6 : b.y - POPUP_H - 6;
  } else {
    // Linux top bars don't report the icon position: use the top-right corner.
    x = wa.x + wa.width - POPUP_W - 10;
    y = wa.y + 10;
  }
  x = Math.min(Math.max(x, wa.x + 6), wa.x + wa.width - POPUP_W - 6);
  y = Math.min(Math.max(y, wa.y + 6), wa.y + wa.height - POPUP_H - 6);
  popup.setPosition(x, y);
}

function showPopup({ auto = false } = {}) {
  if (!popup) return;
  positionPopup();
  clearTimeout(popupAutoHide);
  popupAutoHide = null;
  if (auto) {
    popup.showInactive();
    popupAutoHide = setTimeout(() => {
      popupAutoHide = null;
      if (!popup.isFocused()) popup.hide();
    }, 9000);
  } else {
    popup.show();
    popup.focus();
  }
}

function togglePopup() {
  if (popup?.isVisible()) popup.hide();
  else showPopup();
}

// ------------------------------------------------------------------ tray
function frameImage(dataUrl) {
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  const img = nativeImage.createFromBuffer(buf, { scaleFactor: ICON.scale });
  return img;
}

function createTray() {
  const icon = nativeImage.createFromPath(join(ROOT, 'icons', 'icon-192.png')).resize({ width: ICON.size, height: ICON.size });
  tray = new Tray(process.platform === 'linux' ? icon : nativeImage.createFromBuffer(icon.toPNG(), { scaleFactor: ICON.scale }));
  tray.setToolTip('Charger Pet');
  if (process.platform !== 'linux') {
    tray.on('click', togglePopup);
    tray.on('right-click', () => tray.popUpContextMenu(buildMenu()));
  }
  refreshMenu();
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: `${heroName(settings.hero)} — ${statusText()}`, enabled: false },
    { type: 'separator' },
    { label: 'Show Charger Pet', click: () => showPopup() },
    {
      label: 'Hero',
      submenu: heroes.map((h, i) => ({
        label: `${i + 1}. ${h.name} — ${h.power}`,
        type: 'radio',
        checked: h.id === settings.hero,
        click: () => setHero(h.id),
      })),
    },
    { label: 'Transform to a random hero', click: () => setHero(randomHero()) },
    { type: 'separator' },
    {
      label: 'Pop up when the charger is connected',
      type: 'checkbox',
      checked: settings.popupOnPlug,
      click: (item) => { settings.popupOnPlug = item.checked; saveSettings(); },
    },
    {
      label: 'Transform when the charger is connected',
      type: 'checkbox',
      checked: settings.transformOnPlug,
      click: (item) => { settings.transformOnPlug = item.checked; saveSettings(); },
    },
    {
      label: 'Start at login',
      type: 'checkbox',
      checked: settings.openAtLogin,
      click: (item) => { settings.openAtLogin = item.checked; saveSettings(); applyLoginItem(); },
    },
    { type: 'separator' },
    { label: 'Quit Charger Pet', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
}

let menuKey = '';
function refreshMenu() {
  if (!tray) return;
  const key = `${settings.hero}|${statusText()}|${heroes.length}`;
  const tip = `Charger Pet · ${heroName(settings.hero)} · ${statusText()}`;
  tray.setToolTip(tip);
  // Linux (AppIndicator) has no click events, so the menu is the way in.
  if (process.platform === 'linux' && key !== menuKey) tray.setContextMenu(buildMenu());
  menuKey = key;
}

function randomHero() {
  const others = heroes.filter((h) => h.id !== settings.hero);
  return others.length ? others[(Math.random() * others.length) | 0].id : settings.hero;
}

function setHero(id, { from } = {}) {
  settings.hero = id;
  saveSettings();
  if (from !== spriteWin?.webContents) spriteWin?.webContents.send('pet:set-hero', id);
  if (from !== popup?.webContents) popup?.webContents.send('pet:set-hero', id);
  refreshMenu();
}

// ------------------------------------------------------------------ login item
function applyLoginItem() {
  if (process.platform === 'linux') {
    const dir = join(os.homedir(), '.config', 'autostart');
    const file = join(dir, 'charger-pet.desktop');
    try {
      if (settings.openAtLogin) {
        const exec = process.env.APPIMAGE
          ? `"${process.env.APPIMAGE}"`
          : app.isPackaged ? `"${process.execPath}"` : `"${process.execPath}" "${ROOT}"`;
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, `[Desktop Entry]\nType=Application\nName=Charger Pet\nExec=${exec}\nX-GNOME-Autostart-enabled=true\n`);
      } else if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch {}
  } else {
    app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
  }
}

// ------------------------------------------------------------------ IPC
ipcMain.on('pet:frame', (e, dataUrl) => {
  if (tray && e.sender === spriteWin?.webContents && typeof dataUrl === 'string') tray.setImage(frameImage(dataUrl));
});

ipcMain.on('pet:heroes', (e, list) => {
  if (e.sender !== spriteWin?.webContents || !Array.isArray(list)) return;
  heroes = list;
  if (!heroes.some((h) => h.id === settings.hero)) settings.hero = heroes[0]?.id ?? 'volt';
  refreshMenu();
});

ipcMain.on('pet:battery', (e, s) => {
  if (e.sender !== spriteWin?.webContents) return;
  const plugged = battery.known && !battery.charging && s.charging;
  battery.level = Number(s.level) || 0;
  battery.charging = Boolean(s.charging);
  battery.known = true;
  if (plugged) {
    if (settings.transformOnPlug) setHero(randomHero());
    if (settings.popupOnPlug) showPopup({ auto: true });
  }
  refreshMenu();
});

ipcMain.on('pet:hero-changed', (e, id) => {
  if (heroes.some((h) => h.id === id) && id !== settings.hero) setHero(id, { from: e.sender });
});

ipcMain.on('pet:hide-popup', () => popup?.hide());

// ------------------------------------------------------------------ app
app.on('second-instance', () => showPopup());
app.on('window-all-closed', () => {}); // keep living in the tray
app.on('before-quit', () => { app.isQuitting = true; });

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = normalize(join(ROOT, decodeURIComponent(pathname)));
    if (!file.startsWith(ROOT + sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  loadSettings();
  app.dock?.hide();
  createTray();
  createSpriteWindow();
  createPopup();
  applyLoginItem();

  nativeTheme.on('updated', () => {
    if (process.platform !== 'linux') spriteWin?.webContents.send('pet:theme', nativeTheme.shouldUseDarkColors);
  });
  if (process.argv.includes('--show')) showPopup();
});
