// Cursor Cat desktop app (Windows, macOS, Linux on X11): a small transparent,
// click-through window that holds the cat and follows the mouse pointer.
import { app, BrowserWindow, Tray, Menu, nativeImage, screen } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import { CatBrain, COATS, SPRITE, allSprites } from '../shared/brain.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SIZES = { Small: 56, Medium: 72, Large: 96 };
const SPEEDS = { Slow: 0.7, Normal: 1, Fast: 1.5 };
const COAT_NAMES = { ginger: 'Ginger', smokey: 'Smokey', snowball: 'Snowball' };
const TICK_MS = 16;
const DEBUG = !!process.env.CURSOR_CAT_DEBUG;

// Wayland doesn't let apps place windows or read the global pointer; run through
// XWayland instead. (On Ubuntu's GNOME, the Cursor Cat GNOME extension works better.)
if (process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland') {
  app.commandLine.appendSwitch('ozone-platform', 'x11');
}

if (!app.requestSingleInstanceLock()) app.quit();

// ------------------------------------------------------------------ settings
const settings = { coat: 'ginger', size: 'Medium', speed: 'Normal', paused: false, openAtLogin: false };
const settingsFile = () => join(app.getPath('userData'), 'settings.json');
function loadSettings() {
  try {
    Object.assign(settings, JSON.parse(fs.readFileSync(settingsFile(), 'utf8')));
  } catch {}
  if (!COATS.includes(settings.coat)) settings.coat = 'ginger';
  if (!SIZES[settings.size]) settings.size = 'Medium';
  if (!SPEEDS[settings.speed]) settings.speed = 'Normal';
}
function saveSettings() {
  try {
    fs.mkdirSync(dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  } catch {}
}

// ------------------------------------------------------------------ pointer
// Windows and macOS report the system pointer directly. On Linux/X11 Electron only
// updates it while the pointer is over one of its own windows, so ask X via xdotool.
let readPointer = () => screen.getCursorScreenPoint();
function setupLinuxPointer() {
  let pos = screen.getCursorScreenPoint();
  let busy = false;
  const poll = () => {
    if (busy) return;
    busy = true;
    execFile('xdotool', ['getmouselocation', '--shell'], { timeout: 500 }, (err, out) => {
      busy = false;
      if (err) {
        if (err.code === 'ENOENT') {
          console.warn('Cursor Cat: install xdotool so the cat can follow the pointer (sudo apt install xdotool).');
          clearInterval(linuxPoll);
          readPointer = () => screen.getCursorScreenPoint();
        }
        return;
      }
      const x = /X=(-?\d+)/.exec(out);
      const y = /Y=(-?\d+)/.exec(out);
      if (x && y) pos = screen.screenToDipPoint ? screen.screenToDipPoint({ x: +x[1], y: +y[1] }) : { x: +x[1], y: +y[1] };
    });
  };
  const linuxPoll = setInterval(poll, 33);
  readPointer = () => pos;
}

// ------------------------------------------------------------------ cat window
let win = null;
let tray = null;
let brain = null;
let timer = null;
let last = { x: NaN, y: NaN, sprite: '', frame: -1 };
let lastTick = 0;

const size = () => SIZES[settings.size];

function createWindow() {
  const s = size();
  win = new BrowserWindow({
    width: s,
    height: s,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    title: 'Cursor Cat',
    webPreferences: { preload: join(HERE, 'preload.cjs'), backgroundThrottling: false },
  });
  win.setIgnoreMouseEvents(true); // clicks go straight through to whatever is below
  win.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(join(HERE, 'cat.html'));
  win.webContents.on('did-finish-load', () => {
    sendCoat();
    last.sprite = '';
    if (!settings.paused) win.showInactive();
  });
}

function sendCoat() {
  win?.webContents.send('coat', settings.coat, allSprites());
}

function tick() {
  const now = performance.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  const p = readPointer();
  const s = brain.update(dt, p.x, p.y);
  const px = size();
  const x = Math.round(s.x - (SPRITE.anchorX / SPRITE.size) * px);
  const y = Math.round(s.y - (SPRITE.anchorY / SPRITE.size) * px);
  if (x !== last.x || y !== last.y) {
    win.setBounds({ x, y, width: px, height: px });
    last.x = x;
    last.y = y;
  }
  if (DEBUG && Math.floor(now / 500) !== Math.floor((now - dt * 1000) / 500)) {
    console.log(`pointer ${p.x},${p.y} cat ${Math.round(s.x)},${Math.round(s.y)} ${s.anim}`);
  }
  if (s.sprite !== last.sprite || s.frame !== last.frame) {
    win.webContents.send('frame', s.sprite, s.frame);
    last.sprite = s.sprite;
    last.frame = s.frame;
  }
}

function start() {
  stop();
  const p = screen.getCursorScreenPoint();
  brain ??= new CatBrain({ size: size(), speed: SPEEDS[settings.speed] });
  if (Number.isNaN(last.x)) [brain.x, brain.y] = brain.target(p.x, p.y);
  lastTick = performance.now();
  timer = setInterval(tick, TICK_MS);
  win?.showInactive();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

// ------------------------------------------------------------------ tray menu
function trayIcon() {
  const dir = join(HERE, 'icons');
  if (process.platform === 'win32') return nativeImage.createFromPath(join(dir, 'tray-win.png'));
  const img = nativeImage.createFromPath(join(dir, 'tray.png'));
  img.addRepresentation({ scaleFactor: 2, buffer: fs.readFileSync(join(dir, 'tray@2x.png')) });
  return img;
}

function radio(label, options, key, apply) {
  return {
    label,
    submenu: Object.keys(options).map((name) => ({
      label: options[name] && typeof options[name] === 'string' ? options[name] : name,
      type: 'radio',
      checked: settings[key] === name,
      click: () => {
        settings[key] = name;
        saveSettings();
        apply();
        refreshMenu();
      },
    })),
  };
}

function refreshMenu() {
  const menu = Menu.buildFromTemplate([
    { label: 'Cursor Cat', enabled: false },
    { type: 'separator' },
    {
      label: settings.paused ? 'Bring the cat back' : 'Hide the cat',
      click: () => {
        settings.paused = !settings.paused;
        saveSettings();
        if (settings.paused) {
          stop();
          win.hide();
        } else {
          start();
        }
        refreshMenu();
      },
    },
    radio('Cat', COAT_NAMES, 'coat', sendCoat),
    radio('Size', Object.fromEntries(Object.keys(SIZES).map((k) => [k, k])), 'size', () => {
      brain.configure({ size: size() });
      last.x = NaN;
      if (!settings.paused) {
        const p = screen.getCursorScreenPoint();
        [brain.x, brain.y] = brain.target(p.x, p.y);
      }
    }),
    radio('Speed', Object.fromEntries(Object.keys(SPEEDS).map((k) => [k, k])), 'speed', () => brain.configure({ speed: SPEEDS[settings.speed] })),
    {
      label: 'Start at login',
      type: 'checkbox',
      checked: settings.openAtLogin,
      click: (item) => {
        settings.openAtLogin = item.checked;
        saveSettings();
        applyLoginItem();
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function applyLoginItem() {
  if (process.platform === 'linux') {
    const file = join(os.homedir(), '.config', 'autostart', 'cursor-cat.desktop');
    try {
      if (settings.openAtLogin) {
        const exec = process.env.APPIMAGE ? `"${process.env.APPIMAGE}"` : `"${process.execPath}"${app.isPackaged ? '' : ` "${join(HERE, '..')}"`}`;
        fs.mkdirSync(dirname(file), { recursive: true });
        fs.writeFileSync(file, `[Desktop Entry]\nType=Application\nName=Cursor Cat\nExec=${exec}\nX-GNOME-Autostart-enabled=true\n`);
      } else if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch {}
  } else {
    app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
  }
}

// ------------------------------------------------------------------ app
app.on('window-all-closed', () => {}); // keep running in the tray
app.on('second-instance', () => {
  if (settings.paused) {
    settings.paused = false;
    saveSettings();
    start();
    refreshMenu();
  }
});

app.whenReady().then(() => {
  loadSettings();
  app.dock?.hide();
  tray = new Tray(trayIcon());
  tray.setToolTip('Cursor Cat');
  if (process.platform !== 'linux') tray.on('click', () => tray.popUpContextMenu());
  refreshMenu();
  createWindow();
  if (process.platform === 'linux') setupLinuxPointer();
  if (!settings.paused) start();
});

// Handle for automated tests.
globalThis.cursorCat = { get brain() { return brain; }, get window() { return win; }, settings };
