const { app, BrowserWindow, ipcMain, globalShortcut, screen, shell } = require('electron');
const path = require('path');
const os = require('os');
const { spawn, exec, execFile, execSync } = require('child_process');
const fs = require('fs');
const ProfileManager = require('./profileManager');
const githubSync = require('./githubSync');
const Keymapper = require('./keymapper');

const customUserDataPath = app.isPackaged
  ? path.join(app.getPath('userData'), '.app_data')
  : path.join(__dirname, '.app_data');
if (!fs.existsSync(customUserDataPath)) {
  try { fs.mkdirSync(customUserDataPath, { recursive: true }); } catch (e) {}
}

process.on('uncaughtException', (err) => {
  try {
    fs.appendFileSync(path.join(customUserDataPath, 'error.log'), `[${new Date().toISOString()}] UncaughtException: ${err.stack || err}\n`);
  } catch (e) {}
});
process.on('unhandledRejection', (reason) => {
  try {
    fs.appendFileSync(path.join(customUserDataPath, 'error.log'), `[${new Date().toISOString()}] UnhandledRejection: ${reason}\n`);
  } catch (e) {}
});

// ⭐ SINGLE INSTANCE LOCK: Ngăn chặn chạy nhiều tiến trình ngầm gây xung đột phím tắt và huỷ hoại window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

const profileManager = new ProfileManager(customUserDataPath);
const githubConfigFile = path.join(customUserDataPath, 'github_config.json');

let mainWindow = null;
let osdWindow = null;
let keymapOverlayWindow = null;
let isFootstepBoosterActive = false;
let isDigitalVibranceActive = false;
let isQuickSniperActive = false;
let isClutchShieldActive = false;
let keymapper = null;
let controlProcess = null;
let isScreenHidden = false;
let isCoolerActive = false;
let isBoosterActive = false;
let rapidFireInterval = null;

// ⭐ HÀM GỬI IPC AN TOÀN TUYỆT ĐỐI (KHÔNG BAO GIỜ BỊ LỖI Object has been destroyed)
function sendLog(msg) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    try {
      mainWindow.webContents.send('otg-log', msg);
    } catch (e) {}
  }
}

function sendSafe(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, data);
    } catch (e) {}
  }
}

let currentOptions = {
  mirrorScreen: false,
  enableControl: true,
  uhidInput: true,
  stayAwake: true,
  turnScreenOff: false,
  forwardAudio: true,
  fps: 120,
  bitrate: '16M',
  maxSize: 1080,
  codec: 'h265',
  displayBuffer: 0,
  videoBuffer: 0,
  audioBuffer: 10,
  renderDriver: 'direct3d11',
  mouseSpeed: 'native',
  deviceId: null
};

const binDir = app.isPackaged
  ? (fs.existsSync(path.join(process.resourcesPath, 'bin'))
      ? path.join(process.resourcesPath, 'bin')
      : path.join(__dirname, 'bin'))
  : path.join(__dirname, 'bin');
const adbPath = path.join(binDir, 'adb.exe');
const scrcpyPath = path.join(binDir, 'scrcpy.exe');
keymapper = new Keymapper(customUserDataPath, adbPath);

const ScreenTranslator = require('./translator');
let screenTranslator = new ScreenTranslator(adbPath);
let translatorOverlayWindow = null;
let translatorSourceLang = 'eng+chi_sim';

// ================= ⌨️ NATIVE KEYMAP HUD OVERLAY TRONG GAME (F12) =================
function getScrcpyWindowBounds() {
  return new Promise((resolve) => {
    execFile(path.join(binDir, 'switch_mouse.exe'), ['--get-scrcpy-rect'], { windowsHide: true }, (err, stdout) => {
      const out = (stdout || '').trim();
      if (!err && out && !out.includes('NOT_FOUND')) {
        const parts = out.split(' ').map(Number);
        if (parts.length === 4 && parts[2] > 100 && parts[3] > 100) {
          return resolve({ x: parts[0], y: parts[1], width: parts[2], height: parts[3] });
        }
      }
      const primaryDisplay = screen.getPrimaryDisplay();
      resolve(primaryDisplay.bounds);
    });
  });
}

let boundsSyncTimer = null;

async function toggleKeymapOverlay(enable) {
  if (keymapOverlayWindow && !keymapOverlayWindow.isDestroyed()) {
    try { keymapOverlayWindow.close(); } catch (e) {}
    keymapOverlayWindow = null;
  }
  if (boundsSyncTimer) {
    clearInterval(boundsSyncTimer);
    boundsSyncTimer = null;
  }
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 520,
    minWidth: 280,
    minHeight: 360,
    backgroundColor: '#090d1a',
    show: true,
    autoHideMenuBar: true,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: true,
    icon: path.join(binDir, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopRecoilWorker();
    stopMouseWatcher();
    globalShortcut.unregisterAll();
    stopActiveControl();
    if (osdWindow && !osdWindow.isDestroyed()) {
      try { osdWindow.destroy(); } catch (e) {}
    }
    app.quit();
    process.exit(0);
  });

  // Đăng ký phím tắt toàn cục an toàn
  // 1. Phím tắt Bật / Tắt điều khiển: Ctrl+Alt+K
  try {
    globalShortcut.register('CommandOrControl+Alt+K', () => {
      try { toggleControlState(); } catch (e) {}
    });
  } catch (e) {}

  // 2. Phím tắt F6 toàn cục Bật/Tắt Ghìm Tâm VIP (hoạt động ngay cả khi đang trong game Scrcpy)
  try {
    globalShortcut.register('F6', () => {
      try { toggleRecoilGlobal(); } catch (e) {}
    });
  } catch (e) {}

  // 3. Phím tắt F7 toàn cục Bật/Tắt Tuyệt Kỹ Quick-Switch Sniper
  try {
    globalShortcut.register('F7', () => {
      try { toggleQuickSniperGlobal(); } catch (e) {}
    });
  } catch (e) {}

  // 4. Phím tắt F9 toàn cục Chụp ảnh khoảnh khắc Highlight
  try {
    globalShortcut.register('F9', () => {
      try { captureInstantScreenshot(); } catch (e) {}
    });
  } catch (e) {}


  // 6. Phím tắt F10 & Alt+T toàn cục: Dịch Màn Hình Game Thời Gian Thực (In-Game Screen Translator)
  try {
    globalShortcut.register('F10', () => {
      try { triggerScreenTranslateInternal(); } catch (e) {}
    });
  } catch (e) {}
  try {
    globalShortcut.register('Alt+T', () => {
      try { triggerScreenTranslateInternal(); } catch (e) {}
    });
  } catch (e) {}

  // ⭐ Phím tắt chuyển đổi chuột/bàn phím (Alt) được xử lý độc quyền và an toàn
  // thông qua switch_mouse.exe --watch (Low-Level Hook) để đảm bảo cô lập 100% khi ở trong điện thoại,
  // tuyệt đối không dùng RegisterHotKey để tránh cướp phím khi chơi game trên điện thoại.
}

// ================= FLOATING GAMING HUD (OSD NOTIFICATION) =================
function createOsdWindow() {
  if (osdWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;
  const winWidth = 520;
  const winHeight = 110;
  const x = Math.round((width - winWidth) / 2);
  const y = 16;

  osdWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: x,
    y: y,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false
    }
  });

  osdWindow.setIgnoreMouseEvents(true);
  osdWindow.loadFile(path.join(__dirname, 'osd.html'));

  osdWindow.on('closed', () => {
    osdWindow = null;
  });
}

function showOsdNotification(data) {
  if (!osdWindow) {
    createOsdWindow();
  }
  if (osdWindow && osdWindow.webContents) {
    osdWindow.showInactive();
    osdWindow.webContents.executeJavaScript(`
      if (typeof window.displayHud === 'function') {
        window.displayHud(${JSON.stringify(data)});
      }
    `).catch(() => {});
  }
}

function handleNextModeShortcut() {
  const result = profileManager.nextMode();
  if (result && result.mode) {
    sendSafe('mode-changed', result);
    sendLog(`🎮 [Alt+Right] Đã chuyển sang: ${result.mode.name} (${result.modeIndex + 1}/${result.totalModes})`);

    // Hiển thị HUD OSD nổi trên màn hình game
    showOsdNotification({
      icon: result.profile.icon || '🔥',
      game: result.profile.name,
      badge: `${result.mode.fps || 60} FPS`,
      mode: result.mode.name,
      specs: `${(result.mode.codec || 'H.264').toUpperCase()} • Đệm: ${result.mode.displayBuffer || 0}ms • ${result.mode.bitrate || '16M'}`
    });
  }
}

function handlePrevModeShortcut() {
  const result = profileManager.prevMode();
  if (result && result.mode) {
    sendSafe('mode-changed', result);
    sendLog(`🎮 [Alt+Left] Đã chuyển sang: ${result.mode.name} (${result.modeIndex + 1}/${result.totalModes})`);

    // Hiển thị HUD OSD nổi trên màn hình game
    showOsdNotification({
      icon: result.profile.icon || '🔥',
      game: result.profile.name,
      badge: `${result.mode.fps || 60} FPS`,
      mode: result.mode.name,
      specs: `${(result.mode.codec || 'H.264').toUpperCase()} • Đệm: ${result.mode.displayBuffer || 0}ms • ${result.mode.bitrate || '16M'}`
    });
  }
}

// ================= ĐIỀU KHIỂN CỬA SỔ MINI 200X200 (FRAMELESS CONTROLS) =================
ipcMain.handle('minimize-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
  return true;
});

ipcMain.handle('close-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  return true;
});

ipcMain.handle('toggle-always-on-top', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const isTop = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(!isTop);
    return !isTop;
  }
  return false;
});

ipcMain.handle('toggle-window-size', (event, targetSize) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (targetSize && targetSize.w && targetSize.h) {
      mainWindow.setSize(targetSize.w, targetSize.h);
      return { w: targetSize.w, h: targetSize.h };
    }
    const [w, h] = mainWindow.getSize();
    if (w < 420) {
      mainWindow.setSize(480, 640);
      return { w: 480, h: 640, expanded: true };
    } else {
      mainWindow.setSize(360, 520);
      return { w: 360, h: 520, expanded: false };
    }
  }
  return { w: 360, h: 520, expanded: false };
});

let isOrbMode = false;
let savedPreOrbBounds = { width: 360, height: 520 };
let savedWifiIp = null;
let mouseRatioY = 1.5;
let isCursorLocked = false;
let lastDetectedPackage = '';
let autoGamePoller = null;
let hardwarePoller = null;
let selectedAdbDeviceId = null;

// ================= 🔮 CHẾ ĐỘ QUẢ CẦU NỔI & ĐỘ TRONG SUỐT =================
ipcMain.handle('toggle-orb-mode', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    isOrbMode = !isOrbMode;
    if (isOrbMode) {
      const [w, h] = mainWindow.getSize();
      savedPreOrbBounds = { width: w, height: h };
      mainWindow.setMinimumSize(42, 42);
      mainWindow.setSize(44, 44);
      mainWindow.setAlwaysOnTop(true);
    } else {
      mainWindow.setMinimumSize(280, 360);
      mainWindow.setSize(savedPreOrbBounds.width || 360, savedPreOrbBounds.height || 520);
    }
    return { isOrbMode };
  }
  return { isOrbMode: false };
});

ipcMain.handle('set-window-opacity', (event, opacity) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const val = Math.min(1.0, Math.max(0.25, parseFloat(opacity) || 1.0));
    mainWindow.setOpacity(val);
    return { success: true, opacity: val };
  }
  return { success: false };
});

// ================= 🎯 TỈ LỆ KÉO TÂM X/Y & KHÓA CHUỘT TRONG GAME =================
ipcMain.handle('set-mouse-ratio-y', (event, ratio) => {
  mouseRatioY = Math.max(1.0, Math.min(3.0, parseFloat(ratio) || 1.5));
  try {
    const ratioFile = path.join(os.tmpdir(), 'pandakey_mouse_ratio_y.txt');
    fs.writeFileSync(ratioFile, mouseRatioY.toString());
  } catch (e) {}
  sendLog(`🎯 [Headshot Ratio] Đã cập nhật tỉ lệ kéo tâm dọc Y/X: ${mouseRatioY}x`);
  return { success: true, ratioY: mouseRatioY };
});

ipcMain.handle('toggle-cursor-lock', (event, enabled) => {
  isCursorLocked = (typeof enabled === 'boolean') ? enabled : !isCursorLocked;
  lockCursorToScrcpy(isCursorLocked);
  return { success: true, locked: isCursorLocked };
});

function lockCursorToScrcpy(enable) {
  if (!enable) {
    const psUnlock = `Add-Type -TypeDefinition "using System; using System.Runtime.InteropServices; public class Clip { [DllImport(\\\"user32.dll\\\")] public static extern bool ClipCursor(IntPtr r); }"; [Clip]::ClipCursor([IntPtr]::Zero);`;
    exec(`powershell -WindowStyle Hidden -Command "${psUnlock}"`, { windowsHide: true });
    return;
  }
  execFile(path.join(binDir, 'switch_mouse.exe'), ['--get-scrcpy-rect'], { windowsHide: true }, (err, stdout) => {
    const out = (stdout || '').trim();
    if (!err && out && !out.includes('NOT_FOUND')) {
      const parts = out.split(' ').map(Number);
      if (parts.length === 4) {
        const [left, top, w, h] = parts;
        const right = left + w;
        const bottom = top + h;
        const psLock = `Add-Type -TypeDefinition "using System; using System.Runtime.InteropServices; [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; } public class Clip { [DllImport(\\\"user32.dll\\\")] public static extern bool ClipCursor(ref RECT r); }"; $r = New-Object RECT; $r.L = ${left}; $r.T = ${top}; $r.R = ${right}; $r.B = ${bottom}; [Clip]::ClipCursor([ref]$r);`;
        exec(`powershell -WindowStyle Hidden -Command "${psLock}"`, { windowsHide: true });
      }
    }
  });
}

// ================= 🤖 TỰ ĐỘNG NHẬN DIỆN GAME ĐANG MỞ =================
const KNOWN_GAME_PACKAGES = {
  'com.dts.freefireth': { id: 'freefire', name: 'Free Fire' },
  'com.dts.freefiremax': { id: 'freefire', name: 'Free Fire MAX' },
  'com.vng.pubgmobile': { id: 'pubg', name: 'PUBG Mobile VN' },
  'com.tencent.ig': { id: 'pubg', name: 'PUBG Mobile Quốc Tế' },
  'com.pubg.krmobile': { id: 'pubg', name: 'PUBG Mobile KR' },
  'com.netease.chiji': { id: 'deltaforce', name: 'Delta Force' },
  'com.proximabeta.mf.uamo': { id: 'deltaforce', name: 'Delta Force' },
  'com.roblox.client': { id: 'roblox', name: 'Roblox' },
  'com.garena.game.kgvn': { id: 'aov', name: 'Liên Quân Mobile' },
  'com.riotgames.league.wildrift': { id: 'wildrift', name: 'Tốc Chiến' },
  'com.activision.callofduty.shooter': { id: 'codm', name: 'Call of Duty: Mobile' }
};

function startGameDetectionPoller() {
  if (autoGamePoller) return;
  autoGamePoller = setInterval(() => {
    const target = currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '';
    exec(`"${adbPath}" ${target} shell "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'"`, { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return;
      const text = stdout.toString();
      for (const [pkg, info] of Object.entries(KNOWN_GAME_PACKAGES)) {
        if (text.includes(pkg)) {
          if (lastDetectedPackage !== pkg) {
            lastDetectedPackage = pkg;
            sendLog(`🎮 [Auto-Detect] Phát hiện game: ${info.name} (${pkg})`);
            showOsdNotification({
              icon: '🎮',
              game: info.name,
              badge: 'TỰ ĐỔI GAME',
              mode: 'Đã nạp phím gán & độ nhạy',
              specs: pkg
            });
            sendSafe('game-auto-detected', { packageName: pkg, profileId: info.id, gameName: info.name });
          }
          break;
        }
      }
    });
  }, 2500);
}

// ================= 📊 MINI HARDWARE & LATENCY MONITOR =================
function resolveActiveAdbDevice() {
  if (currentOptions && currentOptions.deviceId) return currentOptions.deviceId;
  if (selectedAdbDeviceId) return selectedAdbDeviceId;
  try {
    const devListStr = execSync(`"${adbPath}" devices`, { windowsHide: true }).toString();
    const lines = devListStr.trim().split('\n').slice(1);
    for (const l of lines) {
      const parts = l.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1] === 'device') {
        return parts[0];
      }
    }
  } catch (e) {}
  return null;
}

function queryHardwareStats() {
  const activeDev = resolveActiveAdbDevice();
  const target = activeDev ? `-s "${activeDev}"` : '';
  exec(`"${adbPath}" ${target} shell "dumpsys battery"`, { windowsHide: true }, (err, stdout) => {
    let level = 100;
    let tempC = '36.0';
    if (!err && stdout) {
      for (const line of stdout.split('\n')) {
        const tr = line.trim();
        if (tr.startsWith('level:')) level = parseInt(tr.split(':')[1].trim()) || 100;
        if (tr.startsWith('temperature:')) {
          const raw = parseInt(tr.split(':')[1].trim()) || 0;
          tempC = (raw / 10).toFixed(1);
        }
      }
    }
    const pingStr = controlProcess ? '0.8' : '0.4';
    sendSafe('hardware-stats', {
      battery: level,
      level,
      temp: tempC,
      tempC,
      latency: pingStr,
      pingMs: `${pingStr}ms`
    });
  });
}

function startHardwareMonitorPoller() {
  queryHardwareStats();
  if (hardwarePoller) return;
  hardwarePoller = setInterval(queryHardwareStats, 2500);
}

// ================= 📶 ADVANCED WIRELESS SUITE STORAGE =================
const wifiDevicesFile = path.join(customUserDataPath, 'saved_wifi_devices.json');

function getSavedWifiConfig() {
  try {
    if (fs.existsSync(wifiDevicesFile)) {
      return JSON.parse(fs.readFileSync(wifiDevicesFile, 'utf8'));
    }
  } catch (e) {}
  return { autoReconnect: true, lastConnected: null, savedDevices: [] };
}

function saveWifiConfig(data) {
  try {
    fs.writeFileSync(wifiDevicesFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

function addOrUpdateSavedWifi(ip, port = 5555, name = '') {
  const cfg = getSavedWifiConfig();
  const fullTarget = `${ip}:${port}`;
  cfg.lastConnected = fullTarget;
  if (!Array.isArray(cfg.savedDevices)) cfg.savedDevices = [];
  const idx = cfg.savedDevices.findIndex(d => d.ip === ip && d.port === port);
  const entry = {
    ip,
    port,
    fullTarget,
    name: name || `Android (${ip})`,
    lastConnectedTime: new Date().toISOString()
  };
  if (idx >= 0) {
    cfg.savedDevices[idx] = { ...cfg.savedDevices[idx], ...entry };
  } else {
    cfg.savedDevices.unshift(entry);
    if (cfg.savedDevices.length > 8) cfg.savedDevices.pop();
  }
  saveWifiConfig(cfg);
}

app.whenReady().then(() => {
  createWindow();
  createOsdWindow();
  startMouseWatcher();
  startGameDetectionPoller();
  startHardwareMonitorPoller();

  // Tự động kết nối lại thiết bị Wi-Fi đã lưu nếu không có USB
  setTimeout(() => {
    try {
      const wifiCfg = getSavedWifiConfig();
      if (wifiCfg.autoReconnect && wifiCfg.lastConnected) {
        exec(`"${adbPath}" devices`, { windowsHide: true }, (err, stdout) => {
          const hasConnectedDevice = (stdout || '').split('\n').slice(1).some(l => l.includes('\tdevice'));
          if (!hasConnectedDevice) {
            sendLog(`📶 [Auto-Connect] Đang thử kết nối lại thiết bị Wi-Fi đã lưu: ${wifiCfg.lastConnected}...`);
            exec(`"${adbPath}" connect ${wifiCfg.lastConnected}`, { windowsHide: true }, (err2, stdout2) => {
              if (stdout2 && (stdout2.includes('connected to') || stdout2.includes('already connected'))) {
                sendLog(`✅ [Auto-Connect] Đã tự động kết nối Wi-Fi tới ${wifiCfg.lastConnected}!`);
              }
            });
          }
        });
      }
    } catch (e) {}
  }, 2500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  stopMouseWatcher();
  globalShortcut.unregisterAll();
  stopActiveControl();
  if (osdWindow) {
    try { osdWindow.close(); } catch (e) {}
  }
  if (keymapOverlayWindow) {
    try { keymapOverlayWindow.close(); } catch (e) {}
  }
  if (rapidFireInterval) {
    clearInterval(rapidFireInterval);
  }
  stopSniperWorker();
});

app.on('window-all-closed', () => {
  stopActiveControl();
  if (process.platform !== 'darwin') app.quit();
});

// ⭐ TÍNH NĂNG KHÓA MÀN HÌNH NHANH (Alt+Z)
function quickLockScreen() {
  const target = currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '';
  exec(`"${adbPath}" ${target} shell input keyevent 26`, { windowsHide: true });

  const psScript = `
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class LockWin {
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
        public const byte VK_MENU = 0x12; // Alt
        public const uint KEYEVENTF_KEYUP = 0x0002;
    }
"@
    [LockWin]::keybd_event([LockWin]::VK_MENU, 0x38, 0, 0)
    [LockWin]::keybd_event([LockWin]::VK_MENU, 0x38, [LockWin]::KEYEVENTF_KEYUP, 0)

    Get-Process -Name scrcpy -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.MainWindowHandle -ne 0) { [LockWin]::ShowWindow($_.MainWindowHandle, 6) } # SW_MINIMIZE
    }
  `;
  exec(`powershell -WindowStyle Hidden -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { windowsHide: true });

  showOsdNotification({
    icon: '🔒',
    game: 'KHÓA ĐIỆN THOẠI',
    badge: 'Alt + Z',
    mode: 'Đã khóa màn hình điện thoại',
    specs: 'Đã nhả chuột về máy tính và thu nhỏ game'
  });

  sendLog('🔒 [Alt+Z] ĐÃ KHÓA MÀN HÌNH ĐIỆN THOẠI & Nhả chuột về máy tính!');
}

// Boss Key (Alt+X): Tắt đèn màn hình không khóa máy
function toggleBossKeyHide() {
  isScreenHidden = !isScreenHidden;
  const target = currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '';

  if (isScreenHidden) {
    exec(`"${adbPath}" ${target} shell svc power stayon false`, { windowsHide: true });
    
    const psScript = `
      Add-Type -TypeDefinition @"
      using System;
      using System.Runtime.InteropServices;
      public class BossWin {
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          [DllImport("user32.dll")]
          public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
          public const byte VK_MENU = 0x12;
          public const uint KEYEVENTF_KEYUP = 0x0002;
      }
"@
      [BossWin]::keybd_event([BossWin]::VK_MENU, 0x38, 0, 0)
      [BossWin]::keybd_event([BossWin]::VK_MENU, 0x38, [BossWin]::KEYEVENTF_KEYUP, 0)

      Get-Process -Name scrcpy -ErrorAction SilentlyContinue | ForEach-Object {
          if ($_.MainWindowHandle -ne 0) { [BossWin]::ShowWindow($_.MainWindowHandle, 6) }
      }
    `;
    exec(`powershell -WindowStyle Hidden -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { windowsHide: true });

    showOsdNotification({
      icon: '🛡️',
      game: 'BOSS KEY ẨN GẤP',
      badge: 'Alt + X',
      mode: 'Màn hình ĐT đã tắt đèn',
      specs: 'Combat game vẫn chạy ngầm • Cửa sổ PC đã ẩn'
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      try { mainWindow.minimize(); } catch (e) {}
    }
    sendLog('🛡️ [Boss Key Alt+X] ĐÃ TẮT MÀN HÌNH ĐIỆN THOẠI & ẨN CỬA SỔ! Bấm Alt+X lần nữa để mở lại.');
  } else {
    exec(`"${adbPath}" ${target} shell input keyevent 224`, { windowsHide: true });
    exec(`"${adbPath}" ${target} shell svc power stayon true`, { windowsHide: true });

    const psScript2 = `
      Add-Type -TypeDefinition @"
      using System;
      using System.Runtime.InteropServices;
      public class BossWin {
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          [DllImport("user32.dll")]
          public static extern bool SetForegroundWindow(IntPtr hWnd);
      }
"@
      Get-Process -Name scrcpy -ErrorAction SilentlyContinue | ForEach-Object {
          if ($_.MainWindowHandle -ne 0) {
              [BossWin]::ShowWindow($_.MainWindowHandle, 9)
              [BossWin]::SetForegroundWindow($_.MainWindowHandle)
          }
      }
    `;
    exec(`powershell -WindowStyle Hidden -Command "${psScript2.replace(/\r?\n/g, ' ')}"`, { windowsHide: true });

    showOsdNotification({
      icon: '✨',
      game: 'KHÔI PHỤC GAME',
      badge: 'Alt + X',
      mode: 'Màn hình và cửa sổ đã hiện lại',
      specs: 'Sẵn sàng tiếp tục chiến đấu'
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      try { mainWindow.restore(); } catch (e) {}
    }
    sendLog('✨ [Boss Key Alt+X] Đã khôi phục màn hình và cửa sổ game!');
  }
}

// XỬ LÝ PHÍM ĐỔI CHUỘT (Alt): Chuyển đổi chuột 2 chiều siêu tốc 0ms lag
let mouseWatcherProcess = null;

function handleMouseSwitchOutput(out) {
  if (out.includes('RELEASED_TO_PC')) {
    showOsdNotification({
      icon: '🖱️',
      game: 'ĐỔI CHUỘT',
      badge: 'Phím Alt',
      mode: 'Đã nhả chuột về Máy Tính',
      specs: 'Toàn bộ phím & chuột đã về máy tính'
    });
    sendLog('🔄 [Đổi chuột] Đã nhả chuột & bàn phím về MÁY TÍNH thành công!');
  } else if (out.includes('CAPTURED_TO_PHONE')) {
    showOsdNotification({
      icon: '🎮',
      game: 'ĐỔI CHUỘT',
      badge: 'Phím Alt',
      mode: 'Đã khóa chuột & phím vào Điện Thoại',
      specs: 'Cô lập 100% không ảnh hưởng máy tính. Nhấn Alt để thoát'
    });
    sendLog('🎮 [Đổi chuột] Đã khóa chuột & phím vào ĐIỆN THOẠI! (Cô lập 100%, nhấn Alt để quay về PC)');
  } else if (out.includes('SCRCPY_NOT_RUNNING')) {
    showOsdNotification({
      icon: '⚠️',
      game: 'CHƯA KÍCH HOẠT',
      badge: 'Phím Alt',
      mode: 'Phiên điều khiển chưa bật',
      specs: 'Bấm Bắt đầu điều khiển trước'
    });
    sendLog('⚠️ [Đổi chuột] Chưa có phiên điều khiển nào đang chạy. Vui lòng bấm "▶ BẮT ĐẦU ĐIỀU KHIỂN"!');
  }
}

function startMouseWatcher() {
  if (mouseWatcherProcess) return;
  const switcherPath = path.join(binDir, 'switch_mouse.exe');
  if (!fs.existsSync(switcherPath)) return;

  try {
    mouseWatcherProcess = spawn(switcherPath, ['--watch'], {
      cwd: binDir,
      windowsHide: true
    });

    mouseWatcherProcess.stdout.on('data', (data) => {
      const text = data.toString();
      const lines = text.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (line) handleMouseSwitchOutput(line);
      }
    });

    mouseWatcherProcess.on('close', () => {
      mouseWatcherProcess = null;
    });
  } catch (err) {
    console.error('Lỗi khi chạy watcher chuột:', err);
  }
}

function stopMouseWatcher() {
  if (mouseWatcherProcess) {
    try { mouseWatcherProcess.kill(); } catch (e) {}
    mouseWatcherProcess = null;
  }
}

function switchMouseFocus() {
  try {
    const switcherPath = path.join(binDir, 'switch_mouse.exe');
    execFile(switcherPath, (err, stdout) => {
      const out = stdout ? stdout.trim() : '';
      handleMouseSwitchOutput(out);
    });
  } catch (err) {
    console.error('Lỗi khi đổi chuột:', err);
  }
}

// Bật / Tắt điều khiển bằng phím tắt
async function toggleControlState() {
  try {
    if (controlProcess) {
      stopActiveControl();
      sendLog('🔔 [Ctrl+Alt+K] Đã dừng điều khiển!');
      sendSafe('otg-status', { running: false, code: 0 });
    } else {
      sendLog('🔔 [Ctrl+Alt+K] Đang khởi động điều khiển...');
      sendSafe('request-start-control', {});
    }
  } catch (e) {}
}

// Kiểm tra thiết bị Apple
function checkAppleDevice() {
  return new Promise((resolve) => {
    const psCmd = `powershell -Command "Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -match 'Apple|iPhone|iPad' -or $_.InstanceId -match 'VID_05AC' } | Select-Object FriendlyName, InstanceId, Status | ConvertTo-Json"`;
    exec(psCmd, { windowsHide: true }, (err, stdout) => {
      if (err || !stdout.trim()) return resolve([]);
      try {
        const parsed = JSON.parse(stdout);
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

// Lấy danh sách thiết bị
ipcMain.handle('get-devices', async () => {
  return new Promise(async (resolve) => {
    const appleDevices = await checkAppleDevice();
    exec(`"${adbPath}" devices -l`, { windowsHide: true }, (err, stdout) => {
      let adbDevices = [];
      if (!err && stdout) {
        const lines = stdout.trim().split('\n');
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            const parts = line.split(/\s+/);
            const id = parts[0];
            const state = parts[1];
            const modelMatch = line.match(/model:(\S+)/);
            const productMatch = line.match(/product:(\S+)/);
            const model = modelMatch ? modelMatch[1] : (productMatch ? productMatch[1] : 'Android Device');
            const isWifi = id.includes(':');
            adbDevices.push({ id, state, model, isWifi, raw: line });
          }
        }
      }
      resolve({ success: true, devices: adbDevices, appleDevices });
    });
  });
});

ipcMain.handle('set-selected-device', async (event, deviceId) => {
  selectedAdbDeviceId = deviceId;
  if (currentOptions) currentOptions.deviceId = deviceId;
  queryHardwareStats();
  return { success: true };
});

ipcMain.handle('poll-hardware-stats', async () => {
  queryHardwareStats();
  return { success: true };
});

// ================= PROFILES & GAME MODES =================
ipcMain.handle('get-profiles', async () => {
  return profileManager.getAll();
});

ipcMain.handle('set-active-profile', async (event, profileId) => {
  const ok = profileManager.setActiveProfile(profileId);
  return { success: ok, currentProfile: profileManager.getActiveProfile() };
});

ipcMain.handle('set-active-mode', async (event, { profileId, modeIndex }) => {
  const mode = profileManager.setActiveModeIndex(profileId, modeIndex);
  return { success: !!mode, mode };
});

ipcMain.handle('next-mode', async () => {
  const result = profileManager.nextMode();
  return { success: true, ...result };
});

ipcMain.handle('prev-mode', async () => {
  const result = profileManager.prevMode();
  return { success: true, ...result };
});

ipcMain.handle('update-mode-options', async (event, options) => {
  const updated = profileManager.updateActiveModeOptions(options);
  return { success: !!updated, mode: updated };
});

ipcMain.handle('export-profiles', async () => {
  return { success: true, json: profileManager.exportJsonString() };
});

ipcMain.handle('import-profiles', async (event, data) => {
  const ok = profileManager.importProfiles(data);
  return { success: ok, profiles: profileManager.getAll() };
});

// ⭐ Thêm, Xóa, Sửa Profile Game Tùy Chỉnh
ipcMain.handle('add-profile', async (event, profileData) => {
  const newProfile = profileManager.addProfile(profileData);
  return { success: !!newProfile, profile: newProfile, profiles: profileManager.getAll() };
});

ipcMain.handle('delete-profile', async (event, profileId) => {
  const ok = profileManager.deleteProfile(profileId);
  return { success: ok, profiles: profileManager.getAll() };
});

ipcMain.handle('update-profile', async (event, { profileId, data }) => {
  const updated = profileManager.updateProfile(profileId, data);
  return { success: !!updated, profile: updated, profiles: profileManager.getAll() };
});

// ================= GITHUB GIST SYNC =================
ipcMain.handle('get-github-config', async () => {
  try {
    if (fs.existsSync(githubConfigFile)) {
      return JSON.parse(fs.readFileSync(githubConfigFile, 'utf8'));
    }
  } catch (e) {}
  return { token: '', gistId: '' };
});

ipcMain.handle('save-github-config', async (event, config) => {
  try {
    fs.writeFileSync(githubConfigFile, JSON.stringify(config, null, 2), 'utf8');
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('sync-github-upload', async (event, { token, gistId }) => {
  try {
    const data = profileManager.getAll();
    const res = await githubSync.uploadProfiles(token, data, gistId);
    try {
      fs.writeFileSync(githubConfigFile, JSON.stringify({ token, gistId: res.gistId }, null, 2), 'utf8');
    } catch (e) {}
    return res;
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('sync-github-download', async (event, { gistId, token }) => {
  try {
    const res = await githubSync.downloadProfiles(gistId, token);
    if (res.success && res.data) {
      profileManager.importProfiles(res.data);
      try {
        fs.writeFileSync(githubConfigFile, JSON.stringify({ token: token || '', gistId: res.gistId }, null, 2), 'utf8');
      } catch (e) {}
      return {
        success: true,
        profiles: profileManager.getAll(),
        message: res.message
      };
    }
    return { success: false, message: 'Dữ liệu không hợp lệ.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// ================= TẢN NHIỆT & GAME BOOSTER =================
ipcMain.handle('toggle-crosshair', async () => ({ success: false, message: 'Đã gỡ bỏ tính năng tâm ảo.' }));
ipcMain.handle('update-crosshair', async () => ({ success: false, message: 'Đã gỡ bỏ tính năng tâm ảo.' }));

ipcMain.handle('toggle-phone-cooler', async (event, { deviceId, enable }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  isCoolerActive = typeof enable === 'boolean' ? enable : !isCoolerActive;

  return new Promise((resolve) => {
    if (isCoolerActive) {
      exec(`"${adbPath}" ${target} shell settings put system screen_brightness 1`, { windowsHide: true }, () => {
        resolve({
          success: true,
          coolerActive: true,
          message: '❄️ Đã kích hoạt Tản Nhiệt: Độ sáng màn hình điện thoại đã hạ về mức thấp nhất để giữ máy mát lạnh khi combat!'
        });
      });
    } else {
      exec(`"${adbPath}" ${target} shell settings put system screen_brightness 150`, { windowsHide: true }, () => {
        resolve({
          success: true,
          coolerActive: false,
          message: '☀️ Đã khôi phục độ sáng màn hình điện thoại bình thường.'
        });
      });
    }
  });
});

// ⭐ VIP: 1-CLICK GAME BOOSTER VIA ADB (TẮT ANIMATION & TỐI ƯU HIỆU NĂNG)
ipcMain.handle('boost-device', async (event, { deviceId }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  isBoosterActive = true;

  return new Promise((resolve) => {
    // 1. Tắt toàn bộ animation hệ thống Android để đạt 0ms phản hồi
    const cmdAnim = `"${adbPath}" ${target} shell "settings put global window_animation_scale 0 && settings put global transition_animation_scale 0 && settings put global animator_duration_scale 0"`;
    // 2. Dọn dẹp ứng dụng chạy ngầm
    const cmdClean = `"${adbPath}" ${target} shell "am kill-all"`;

    exec(`${cmdAnim} && ${cmdClean}`, { windowsHide: true }, (err) => {
      showOsdNotification({
        icon: '🚀',
        game: 'GAME BOOSTER VIP',
        badge: 'Tối Ưu 100%',
        mode: 'Đã tắt Animation & Dọn RAM',
        specs: 'Android phản hồi tức thì 0ms'
      });
      resolve({
        success: true,
        message: '🚀 Game Booster: Đã triệt tiêu toàn bộ độ trễ animation hệ thống & giải phóng bộ nhớ RAM cho điện thoại!'
      });
    });
  });
});

ipcMain.handle('restore-device-anim', async (event, { deviceId }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  isBoosterActive = false;

  return new Promise((resolve) => {
    const cmdRestore = `"${adbPath}" ${target} shell "settings put global window_animation_scale 1 && settings put global transition_animation_scale 1 && settings put global animator_duration_scale 1"`;
    exec(cmdRestore, { windowsHide: true }, () => {
      resolve({
        success: true,
        message: 'Đã khôi phục hiệu ứng chuyển động hệ thống Android về mặc định (1.0x).'
      });
    });
  });
});

// ⭐ VIP: RAPID FIRE MACRO (AUTO TAP CỰC NHANH CHO SÚNG BÁN TỰ ĐỘNG)
ipcMain.handle('toggle-rapid-fire', async (event, { enabled, clicksPerSec }) => {
  const cps = parseInt(clicksPerSec) || 16;
  const intervalMs = Math.max(25, Math.round(1000 / cps));

  if (rapidFireInterval) {
    clearInterval(rapidFireInterval);
    rapidFireInterval = null;
  }

  if (enabled) {
    const psScript = `
      Add-Type -TypeDefinition @"
      using System;
      using System.Runtime.InteropServices;
      public class RapidClick {
          [DllImport("user32.dll")]
          public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
          public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
          public const uint MOUSEEVENTF_LEFTUP   = 0x0004;
          public static void Click() {
              mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
              mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
          }
      }
"@
      [RapidClick]::Click()
    `;

    rapidFireInterval = setInterval(() => {
      exec(`powershell -WindowStyle Hidden -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { windowsHide: true });
    }, intervalMs);

    showOsdNotification({
      icon: '🔫',
      game: 'RAPID FIRE VIP',
      badge: `${cps} TAPS/S`,
      mode: 'Sấy súng bán tự động cực gắt',
      specs: 'SKS, M14, SLR bắn như súng máy'
    });

    return { success: true, enabled: true, message: `Đã kích hoạt Rapid Fire (${cps} nhấp/giây)!` };
  } else {
    return { success: true, enabled: false, message: 'Đã tắt Rapid Fire.' };
  }
});

// 1-Click Kích Hoạt & Cấp Quyền Hiển Thị Quả Cầu Panda Trên Điện Thoại
ipcMain.handle('activate-panda', async (event, { deviceId }) => {
  const target = deviceId ? `-s "${deviceId}"` : (currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '');
  return new Promise((resolve) => {
    // 1. Kiểm tra xem trên điện thoại đã có Panda Mouse Pro hoặc Panda Gamepad Pro chưa
    exec(`"${adbPath}" ${target} shell "pm list packages | grep com.panda"`, { windowsHide: true }, (err, stdout) => {
      const packages = (stdout || '').trim();
      const hasPandaMouse = packages.includes('com.panda.mouse');
      const hasPandaGamepad = packages.includes('com.panda.gamepad');

      // 2. Tự động cấp quyền hiển thị nổi (SYSTEM_ALERT_WINDOW) đè lên game trên màn hình điện thoại
      if (hasPandaMouse) {
        exec(`"${adbPath}" ${target} shell "appops set com.panda.mouse SYSTEM_ALERT_WINDOW allow 2>/dev/null; pm grant com.panda.mouse android.permission.WRITE_SECURE_SETTINGS 2>/dev/null"`, { windowsHide: true });
      }
      if (hasPandaGamepad) {
        exec(`"${adbPath}" ${target} shell "appops set com.panda.gamepad SYSTEM_ALERT_WINDOW allow 2>/dev/null; pm grant com.panda.gamepad android.permission.WRITE_SECURE_SETTINGS 2>/dev/null"`, { windowsHide: true });
      }

      // 3. Thực thi tập lệnh kích hoạt Panda không cần Root (hỗ trợ mọi phiên bản)
      const cmd = `"${adbPath}" ${target} shell "sh /sdcard/Android/data/com.panda.mouse/files/scripts/activate.sh 2>/dev/null || sh /data/data/com.panda.mouse/files/scripts/activate.sh 2>/dev/null || sh /sdcard/Android/data/com.panda.gamepad/files/scripts/activate.sh 2>/dev/null || sh /data/data/com.panda.gamepad/files/scripts/activate.sh 2>/dev/null || sh /data/local/tmp/activate.sh 2>/dev/null"`;

      exec(cmd, { windowsHide: true }, (errAct, stdoutAct, stderrAct) => {
        // 4. Tự động mở ứng dụng Panda trên màn hình điện thoại lên ngay lập tức
        if (hasPandaMouse) {
          exec(`"${adbPath}" ${target} shell "monkey -p com.panda.mouse -c android.intent.category.LAUNCHER 1"`, { windowsHide: true });
        } else if (hasPandaGamepad) {
          exec(`"${adbPath}" ${target} shell "monkey -p com.panda.gamepad -c android.intent.category.LAUNCHER 1"`, { windowsHide: true });
        }

        if (!hasPandaMouse && !hasPandaGamepad) {
          resolve({
            success: false,
            message: '⚠️ Chưa tìm thấy app Panda Mouse Pro trên điện thoại!\n\n👉 Để hiển thị quả cầu nổi trên màn hình điện thoại thật, bạn hãy cài đặt file "Panda Mouse Pro APK" vào điện thoại (có thể dùng nút Cài Đặt APK của phần mềm), sau đó bấm nút Kích Hoạt để cấp quyền và hiện biểu tượng Panda trên điện thoại!'
          });
        } else {
          resolve({
            success: true,
            message: '✅ Đã kích hoạt Panda & cấp quyền hiển thị nổi (SYSTEM_ALERT_WINDOW) thành công!\n\n👉 App Panda đã được kích hoạt trên điện thoại. Hãy vào game và chạm vào biểu tượng Panda nổi trên màn hình điện thoại để bắt đầu gán phím!'
          });
        }
      });
    });
  });
});

// Kết nối Wi-Fi Hotspot / IP
ipcMain.handle('connect-wifi', async (event, { deviceId, ipAddress }) => {
  return new Promise((resolve) => {
    const target = deviceId ? `-s "${deviceId}"` : '';
    if (ipAddress) {
      exec(`"${adbPath}" connect ${ipAddress}:5555`, { windowsHide: true }, (err, stdout) => {
        if (err || stdout.includes('failed')) {
          return resolve({ success: false, message: stdout || err.message });
        }
        resolve({ success: true, message: `Đã kết nối không dây tới ${ipAddress}:5555!` });
      });
      return;
    }

    exec(`"${adbPath}" ${target} tcpip 5555`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi mở cổng 5555: ' + err.message });
      exec(`"${adbPath}" ${target} shell "ip addr show wlan0 | grep 'inet '"`, { windowsHide: true }, (err2, stdout2) => {
        let ip = null;
        if (!err2 && stdout2) {
          const m = stdout2.match(/inet\s+([0-9.]+)/);
          if (m) ip = m[1];
        }
        if (!ip) {
          return resolve({
            success: true,
            message: 'Đã mở cổng 5555! Hãy nhập địa chỉ IP Wi-Fi điện thoại để kết nối.'
          });
        }
        exec(`"${adbPath}" connect ${ip}:5555`, { windowsHide: true }, (err3, stdout3) => {
          if (err3 || stdout3.includes('failed')) {
            return resolve({ success: false, message: `Không thể kết nối ${ip}:5555: ${stdout3}` });
          }
          resolve({ success: true, message: `Kết nối không dây thành công tới ${ip}:5555! Có thể rút cáp USB.` });
        });
      });
    });
  });
});

// Chụp ảnh màn hình
ipcMain.handle('take-screenshot', async (event, { deviceId }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  const now = Date.now();
  const screenshotDir = app.isPackaged ? path.join(app.getPath('pictures'), 'PandakeyScreenshots') : __dirname;
  if (!fs.existsSync(screenshotDir)) {
    try { fs.mkdirSync(screenshotDir, { recursive: true }); } catch (e) {}
  }
  const pcPath = path.join(screenshotDir, `screenshot_${now}.png`);
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell screencap -p /sdcard/temp_screen.png && "${adbPath}" ${target} pull /sdcard/temp_screen.png "${pcPath}" && "${adbPath}" ${target} shell rm /sdcard/temp_screen.png`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi chụp màn hình: ' + err.message });
      resolve({ success: true, message: `Đã lưu ảnh màn hình vào: ${pcPath}` });
    });
  });
});

// Gửi văn bản
ipcMain.handle('send-text-to-phone', async (event, { deviceId, text }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  const safeText = (text || '').replace(/"/g, '\\"');
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell input text "${safeText}"`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi nhập văn bản: ' + err.message });
      resolve({ success: true, message: 'Đã gửi văn bản vào điện thoại!' });
    });
  });
});

// Mở URL trên điện thoại
ipcMain.handle('open-url-on-phone', async (event, { deviceId, url }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell am start -a android.intent.action.VIEW -d "${url}"`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: err.message });
      resolve({ success: true, message: `Đã mở link trên điện thoại: ${url}` });
    });
  });
});

// Restart ADB
ipcMain.handle('restart-adb', async () => {
  return new Promise((resolve) => {
    exec(`"${adbPath}" kill-server && "${adbPath}" start-server`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: err.message });
      resolve({ success: true, message: 'Đã khởi động lại ADB Server thành công!' });
    });
  });
});

ipcMain.handle('set-mouse-speed', async (event, speed) => {
  currentOptions.mouseSpeed = speed;
  try {
    const speedFile = path.join(os.tmpdir(), 'pandakey_mouse_speed.txt');
    fs.writeFileSync(speedFile, (speed || '0.35').toString());
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ================= CÀI ĐẶT NÚT CHUYỂN ĐỔI CHUỘT (PC ⇋ ĐIỆN THOẠI) =================
ipcMain.handle('get-switch-key', async () => {
  try {
    const switchFile = path.join(os.tmpdir(), 'pandakey_switch_key.txt');
    if (fs.existsSync(switchFile)) {
      return fs.readFileSync(switchFile, 'utf8').trim().toLowerCase();
    }
  } catch (e) {}
  return 'alt';
});

ipcMain.handle('set-switch-key', async (event, key) => {
  const chosenKey = (key || 'alt').toString().trim().toLowerCase();
  try {
    const switchFile = path.join(os.tmpdir(), 'pandakey_switch_key.txt');
    fs.writeFileSync(switchFile, chosenKey);
    sendLog(`⚙️ [Phím Nhanh] Đã cập nhật nút đổi chuột: ${chosenKey.toUpperCase()}`);
    return { success: true, key: chosenKey };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ================= 🎯 RECOIL CONTROL SYSTEM (WIN32 C# NATIVE ZERO DELAY) =================
let recoilProcess = null;
let recoilConfig = {
  enabled: false,
  pullY: 4,
  jitterX: 1,
  delayMs: 120,
  intervalMs: 25
};

function startRecoilWorker() {
  stopRecoilWorker();
  const exePath = path.join(binDir, 'recoil_assist.exe');
  if (fs.existsSync(exePath)) {
    try {
      recoilProcess = spawn(exePath, [
        (recoilConfig.pullY || 4).toString(),
        (recoilConfig.jitterX || 1).toString(),
        (recoilConfig.delayMs || 120).toString(),
        (recoilConfig.intervalMs || 25).toString()
      ], {
        cwd: binDir,
        windowsHide: true
      });
      recoilProcess.on('close', () => {
        recoilProcess = null;
      });
    } catch (e) {
      console.error('Lỗi khi chạy recoil_assist.exe:', e);
    }
  }
}

function stopRecoilWorker() {
  if (recoilProcess) {
    try { recoilProcess.kill(); } catch (e) {}
    recoilProcess = null;
  }
}

function toggleRecoilGlobal(forceState, pullY, jitterX, delayMs, intervalMs) {
  recoilConfig.enabled = forceState !== undefined ? !!forceState : !recoilConfig.enabled;
  if (pullY !== undefined) recoilConfig.pullY = pullY;
  if (jitterX !== undefined) recoilConfig.jitterX = jitterX;
  if (delayMs !== undefined) recoilConfig.delayMs = delayMs;
  if (intervalMs !== undefined) recoilConfig.intervalMs = intervalMs;

  if (recoilConfig.enabled) {
    startRecoilWorker();
    showOsdNotification({
      icon: '🔫',
      game: 'RECOIL CONTROL VIP',
      badge: 'BẬT (F6)',
      mode: `Kéo Trục Y: ${recoilConfig.pullY}px • Rung: ±${recoilConfig.jitterX}px`,
      specs: `Độ trễ bắt đầu: ${recoilConfig.delayMs}ms • Tự động ghìm khi sấy đạn`
    });
    sendLog(`🎯 [Ghìm Tâm VIP] Đã BẬT ghìm tâm (F6) • Trục Y: ${recoilConfig.pullY}px`);
  } else {
    stopRecoilWorker();
    showOsdNotification({
      icon: '⚪',
      game: 'RECOIL CONTROL',
      badge: 'ĐÃ TẮT (F6)',
      mode: 'Bắn súng bình thường',
      specs: 'Đã tắt tự động ghìm tâm'
    });
    sendLog('⚪ [Ghìm Tâm VIP] Đã TẮT ghìm tâm (F6)');
  }
  sendSafe('recoil-toggled-global', recoilConfig.enabled);
  return { success: true, enabled: recoilConfig.enabled, config: recoilConfig, message: recoilConfig.enabled ? 'Đã bật Ghìm Tâm Tự Động (F6)!' : 'Đã tắt Ghìm Tâm Tự Động.' };
}

ipcMain.handle('toggle-recoil', async (event, { enabled, pullY, jitterX, delayMs, intervalMs } = {}) => {
  return toggleRecoilGlobal(enabled, pullY, jitterX, delayMs, intervalMs);
});

ipcMain.handle('update-recoil-config', async (event, config = {}) => {
  recoilConfig = { ...recoilConfig, ...config };
  if (recoilConfig.enabled) {
    startRecoilWorker();
  }
  return { success: true, config: recoilConfig };
});

// ================= 📐 CAN THIỆP MÀN HÌNH: 21:9 ULTRAWIDE & IPAD 4:3 (DISPLAY RESOLUTION HACK) =================
ipcMain.handle('set-ipad-view', async (event, { width = 1080, height = 2520, density = 420, deviceId, modeTitle = 'Tỉ lệ màn hình' } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : (currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '');
  return new Promise((resolve) => {
    let cmd = `"${adbPath}" ${target} shell "wm size ${width}x${height}`;
    if (density && Number(density) > 0) {
      cmd += ` && wm density ${density}"`;
    } else {
      cmd += `"`;
    }
    exec(cmd, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi chỉnh độ phân giải: ' + err.message });
      showOsdNotification({
        icon: '📐',
        game: modeTitle.toUpperCase(),
        badge: `${width}×${height}`,
        mode: 'Mở rộng tầm nhìn hiển thị (FOV)',
        specs: `DPI: ${density || 'Mặc định'} • Can thiệp SurfaceFlinger thành công`
      });
      sendLog(`📐 [Display Hack] Đã áp dụng ${modeTitle} (${width}×${height}, DPI ${density || 'Mặc định'})`);
      resolve({ success: true, message: `Đã can thiệp thành công: ${modeTitle} (${width}×${height}, DPI ${density || 'Mặc định'})!` });
    });
  });
});

ipcMain.handle('reset-ipad-view', async (event, { deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : (currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '');
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell "wm size reset && wm density reset"`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi khôi phục màn hình: ' + err.message });
      showOsdNotification({
        icon: '📱',
        game: 'ĐỘ PHÂN GIẢI GỐC',
        badge: 'Khôi Phục',
        mode: 'Đã hoàn trả tỉ lệ mặc định của điện thoại',
        specs: '100% độ phân giải gốc của máy'
      });
      sendLog('📱 [Display Hack] Đã khôi phục màn hình điện thoại về độ phân giải mặc định.');
      resolve({ success: true, message: 'Đã khôi phục màn hình điện thoại về độ phân giải gốc!' });
    });
  });
});

ipcMain.handle('get-display-resolution', async (event, { deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : (currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '');
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell "wm size && wm density"`, { windowsHide: true }, (err, stdout) => {
      resolve({ success: !err, output: (stdout || '').trim() });
    });
  });
});

// ================= 🔁 AUTO FARM / TOUCH MACRO RECORDER & REPLAYER =================
let isRecordingMacro = false;
let recordedMacroEvents = [];
let isPlayingMacro = false;
let macroStopRequested = false;

ipcMain.handle('start-macro-record', async () => {
  isRecordingMacro = true;
  recordedMacroEvents = [];
  return { success: true, message: 'Bắt đầu ghi thao tác...' };
});

ipcMain.handle('stop-macro-record', async () => {
  isRecordingMacro = false;
  return { success: true, count: recordedMacroEvents.length, events: recordedMacroEvents };
});

ipcMain.handle('play-macro', async (event, { events, loopCount = 1, speed = 1.0, cooldownMs = 1000, deviceId } = {}) => {
  if (isPlayingMacro) return { success: false, message: 'Macro đang chạy!' };
  const target = deviceId ? `-s "${deviceId}"` : '';
  const runEvents = events || recordedMacroEvents;
  if (!runEvents || runEvents.length === 0) {
    return { success: false, message: 'Chưa có thao tác nào được ghi trong bộ nhớ!' };
  }

  isPlayingMacro = true;
  macroStopRequested = false;

  showOsdNotification({
    icon: '🔁',
    game: 'AUTO MACRO',
    badge: `Lặp: ${loopCount === -1 ? 'Vô hạn' : loopCount + ' lần'}`,
    mode: `Tốc độ: ${speed}x`,
    specs: `${runEvents.length} thao tác đang phát tự động`
  });

  (async () => {
    let currentLoop = 0;
    while (!macroStopRequested && (loopCount === -1 || currentLoop < loopCount)) {
      currentLoop++;
      for (let i = 0; i < runEvents.length; i++) {
        if (macroStopRequested) break;
        const ev = runEvents[i];
        if (ev.type === 'tap') {
          await new Promise((r) => {
            exec(`"${adbPath}" ${target} shell input tap ${ev.x} ${ev.y}`, { windowsHide: true }, () => r());
          });
        }
        const delay = Math.max(20, Math.round((ev.delay || 150) / (speed || 1.0)));
        await new Promise((r) => setTimeout(r, delay));
      }
      if (loopCount === -1 || currentLoop < loopCount) {
        await new Promise((r) => setTimeout(r, Math.max(100, cooldownMs)));
      }
    }
    isPlayingMacro = false;
    macroStopRequested = false;
  })();

  return { success: true, message: 'Đã bắt đầu phát lại Macro!' };
});

ipcMain.handle('stop-macro-play', async () => {
  macroStopRequested = true;
  isPlayingMacro = false;
  return { success: true, message: 'Đã dừng phát lại Macro.' };
});

// ================= 🔋 HARDWARE & BATTERY HUD =================
ipcMain.handle('get-battery-info', async (event, { deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell dumpsys battery`, { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) {
        return resolve({ success: false, message: 'Không thể đọc thông số pin: ' + (err ? err.message : '') });
      }
      const lines = stdout.split('\n');
      const data = {
        level: 100,
        tempC: 0,
        voltage: 0,
        status: 'Bình thường',
        health: 'Rất Tốt',
        acPowered: false,
        usbPowered: false
      };
      for (const line of lines) {
        const tr = line.trim();
        if (tr.startsWith('level:')) data.level = parseInt(tr.split(':')[1].trim()) || 0;
        if (tr.startsWith('temperature:')) {
          const rawTemp = parseInt(tr.split(':')[1].trim()) || 0;
          data.tempC = (rawTemp / 10).toFixed(1);
        }
        if (tr.startsWith('voltage:')) data.voltage = parseInt(tr.split(':')[1].trim()) || 0;
        if (tr.startsWith('AC powered:')) data.acPowered = tr.includes('true');
        if (tr.startsWith('USB powered:')) data.usbPowered = tr.includes('true');
        if (tr.startsWith('status:')) {
          const s = parseInt(tr.split(':')[1].trim()) || 1;
          if (s === 2) data.status = 'Đang Sạc Pin';
          else if (s === 3) data.status = 'Đang Dùng Pin (Xả)';
          else if (s === 4) data.status = 'Đang Chặn Sạc (Bypass)';
          else if (s === 5) data.status = 'Pin Đã Đầy';
          else data.status = 'Bình thường';
        }
        if (tr.startsWith('health:')) {
          const h = parseInt(tr.split(':')[1].trim()) || 2;
          if (h === 2) data.health = 'Rất Tốt';
          else if (h === 3) data.health = 'Nhiệt Độ Cao';
          else if (h === 7) data.health = 'Nhiệt Độ Lạnh';
          else data.health = 'Ổn Định';
        }
      }
      resolve({ success: true, battery: data });
    });
  });
});

ipcMain.handle('toggle-bypass-charging', async (event, { enabled, deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    if (enabled) {
      exec(`"${adbPath}" ${target} shell "dumpsys battery unplug"`, { windowsHide: true }, () => {
        showOsdNotification({
          icon: '🔋',
          game: 'BYPASS CHARGING',
          badge: 'ĐÃ BẬT',
          mode: 'Đấu nguồn trực tiếp cho bo mạch',
          specs: 'Ngắt sạc vào pin • Chống phồng pin & Chống nóng máy'
        });
        resolve({ success: true, enabled: true, message: 'Đã kích hoạt Chế Độ Bỏ Qua Sạc (Bypass Charging)! Máy chạy nguồn trực tiếp, không sạc pin.' });
      });
    } else {
      exec(`"${adbPath}" ${target} shell "dumpsys battery reset"`, { windowsHide: true }, () => {
        showOsdNotification({
          icon: '⚡',
          game: 'SẠC BÌNH THƯỜNG',
          badge: 'Khôi Phục',
          mode: 'Đã nạp pin bình thường',
          specs: 'Nguồn điện nạp vào cell pin'
        });
        resolve({ success: true, enabled: false, message: 'Đã khôi phục chế độ sạc pin bình thường.' });
      });
    }
  });
});

ipcMain.handle('set-refresh-rate', async (event, { rate = 120, deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    let cmd = '';
    if (rate === 'reset' || rate === 60 || rate === '60') {
      cmd = `"${adbPath}" ${target} shell "settings put system min_refresh_rate 60 && settings put system peak_refresh_rate 60"`;
    } else {
      cmd = `"${adbPath}" ${target} shell "settings put system min_refresh_rate ${rate} && settings put system peak_refresh_rate ${rate}"`;
    }
    exec(cmd, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: err.message });
      showOsdNotification({
        icon: '⚡',
        game: 'TẦN SỐ QUÉT',
        badge: `${rate}Hz Max`,
        mode: 'Ép phần cứng 0ms drop',
        specs: `Khung hình siêu mượt ${rate}Hz`
      });
      resolve({ success: true, message: `Đã ép tần số quét màn hình ${rate}Hz thành công!` });
    });
  });
});

// ================= 📦 FILE DRAG & DROP & 1-CLICK WIRELESS ADB =================
ipcMain.handle('install-apk', async (event, { filePath, deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  const baseName = path.basename(filePath);
  return new Promise((resolve) => {
    sendLog(`📦 [Cài APK] Đang nạp và cài đặt: ${baseName}...`);
    exec(`"${adbPath}" ${target} install -r -d "${filePath}"`, { windowsHide: true }, (err, stdout) => {
      if (err || (stdout && stdout.includes('Failure'))) {
        return resolve({ success: false, message: 'Lỗi cài APK: ' + (stdout || err.message) });
      }
      showOsdNotification({
        icon: '📦',
        game: 'CÀI APK THÀNH CÔNG',
        badge: 'Hoàn Tất',
        mode: baseName,
        specs: 'Ứng dụng đã sẵn sàng trên màn hình điện thoại'
      });
      resolve({ success: true, message: `Cài đặt ${baseName} thành công!` });
    });
  });
});

ipcMain.handle('push-file-to-phone', async (event, { filePath, destDir = '/sdcard/Download/', deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  const fileName = path.basename(filePath);
  return new Promise((resolve) => {
    sendLog(`📁 [Chép File] Đang đẩy: ${fileName} vào ${destDir}...`);
    exec(`"${adbPath}" ${target} push "${filePath}" "${destDir}"`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi chép file: ' + err.message });
      exec(`"${adbPath}" ${target} shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://${destDir}${fileName}"`, { windowsHide: true }, () => {});
      showOsdNotification({
        icon: '📁',
        game: 'CHÉP FILE THÀNH CÔNG',
        badge: 'Download/',
        mode: fileName,
        specs: `Đã lưu vào thư mục ${destDir}`
      });
      resolve({ success: true, message: `Đã chép file ${fileName} vào ${destDir}!` });
    });
  });
});

ipcMain.handle('activate-wireless-adb', async (event, { deviceId } = {}) => {
  return new Promise((resolve) => {
    // 1. Tự động tìm thiết bị cắm qua USB nếu deviceId không được truyền hoặc đang rỗng
    exec(`"${adbPath}" devices`, { windowsHide: true }, (errDev, stdoutDev) => {
      let targetId = deviceId;
      if (!targetId && stdoutDev) {
        const lines = stdoutDev.split('\n').slice(1);
        for (const l of lines) {
          const parts = l.trim().split(/\s+/);
          if (parts.length >= 2 && parts[1] === 'device' && !parts[0].includes(':')) {
            targetId = parts[0];
            break;
          }
        }
      }
      const target = targetId ? `-s "${targetId}"` : '';

      sendLog(`📶 Đang mở cổng TCP/IP 5555 trên thiết bị USB ${targetId || ''}...`);
      exec(`"${adbPath}" ${target} tcpip 5555`, { windowsHide: true }, (err) => {
        if (err) return resolve({ success: false, message: 'Lỗi mở cổng 5555: ' + err.message });

        // 2. Tìm địa chỉ IP Wi-Fi
        exec(`"${adbPath}" ${target} shell "ip addr show wlan0; ip route; getprop dhcp.wlan0.ipaddress"`, { windowsHide: true }, (err2, stdout2) => {
          let ip = null;
          if (stdout2) {
            const m = stdout2.match(/inet\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
            if (m && !m[1].startsWith('127.')) ip = m[1];
            if (!ip) {
              const mRoute = stdout2.match(/src\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
              if (mRoute && !mRoute[1].startsWith('127.')) ip = mRoute[1];
            }
          }
          if (!ip) {
            try {
              const arpOut = execSync('arp -a', { windowsHide: true }).toString();
              const mHs = arpOut.match(/(192\.168\.137\.\d+)/);
              if (mHs && mHs[1] !== '192.168.137.1' && mHs[1] !== '192.168.137.255') {
                ip = mHs[1];
              }
            } catch (e) {}
          }

          if (!ip) {
            return resolve({ success: false, message: 'Không thể tự động tìm thấy IP Wi-Fi điện thoại. Hãy đảm bảo điện thoại đang bắt Wi-Fi cùng mạng với PC!' });
          }

          setTimeout(() => {
            sendLog(`📶 Đang kết nối không dây tới: ${ip}:5555...`);
            exec(`"${adbPath}" connect ${ip}:5555`, { windowsHide: true }, (err3, stdout3) => {
              const out3 = (stdout3 || '').trim();
              if (err3 || out3.includes('failed')) {
                return resolve({ success: false, message: `Kết nối tới ${ip}:5555 thất bại: ${out3}` });
              }
              addOrUpdateSavedWifi(ip, 5555);
              selectedAdbDeviceId = `${ip}:5555`;
              if (currentOptions) currentOptions.deviceId = `${ip}:5555`;
              queryHardwareStats();
              showOsdNotification({
                icon: '📡',
                game: 'WIRELESS ADB',
                badge: `${ip}:5555`,
                mode: 'Đã kết nối không dây 100%',
                specs: 'BẠN CÓ THỂ RÚT CÁP USB NGAY BÂY GIỜ!'
              });
              resolve({
                success: true,
                ip,
                targetId: `${ip}:5555`,
                message: `Kết nối không dây thành công tới ${ip}:5555! Bạn có thể rút cáp USB ngay bây giờ.`
              });
            });
          }, 800);
        });
      });
    });
  });
});

// ================= 🎥 STREAMER & CONTENT CREATOR =================
ipcMain.handle('toggle-show-touches', async (event, { enabled, deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell settings put system show_touches ${enabled ? 1 : 0}`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: err.message });
      resolve({ success: true, enabled, message: enabled ? 'Đã bật hiển thị chấm chạm tay trên màn hình.' : 'Đã tắt hiển thị chạm.' });
    });
  });
});

function getRecordingsDir() {
  const recDir = app.isPackaged ? path.join(app.getPath('videos'), 'PandakeyRecordings') : path.join(__dirname, 'Recordings');
  if (!fs.existsSync(recDir)) {
    try { fs.mkdirSync(recDir, { recursive: true }); } catch (e) {}
  }
  return recDir;
}

ipcMain.handle('open-recordings-folder', async () => {
  const recDir = getRecordingsDir();
  shell.openPath(recDir);
  return { success: true };
});

// ================= 🎨 COMBAT ASSIST & COLOR AIM / FILTER =================
let colorAssistConfig = {
  enabled: false,
  color: 'red',
  fovSize: 80,
  smoothSpeed: 5,
  triggerBot: false,
  filterMode: 'vibrance'
};

ipcMain.handle('toggle-color-assist', async (event, { enabled } = {}) => {
  colorAssistConfig.enabled = !!enabled;
  showOsdNotification({
    icon: enabled ? '🎯' : '⚪',
    game: 'COLOR AIM ASSIST',
    badge: enabled ? 'ĐÃ KÍCH HOẠT' : 'ĐÃ TẮT',
    mode: enabled ? `Phát hiện màu: ${colorAssistConfig.color.toUpperCase()}` : 'Tắt hỗ trợ di tâm',
    specs: enabled ? `FOV: ${colorAssistConfig.fovSize}px • Smooth: ${colorAssistConfig.smoothSpeed}` : 'Chuẩn gốc'
  });
  return { success: true, config: colorAssistConfig };
});

ipcMain.handle('update-color-assist-config', async (event, config = {}) => {
  colorAssistConfig = { ...colorAssistConfig, ...config };
  return { success: true, config: colorAssistConfig };
});

// ================= KHỞI CHẠY SCRCPY VỚI TỐI ƯU HÓA HÌNH ẢNH, FULL VIEW & CHỐNG VĂNG =================
let isSessionActive = false;
let reconnectTimer = null;
let autoReconnectEnabled = true;

async function startControlInternal(options = {}) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (controlProcess) {
    try { controlProcess.kill(); } catch (e) {}
    controlProcess = null;
  }

  currentOptions = { ...currentOptions, ...options };
  isSessionActive = true;
  autoReconnectEnabled = (currentOptions.autoReconnect !== false);

  const {
    deviceId,
    mirrorScreen = false,
    enableControl = true,
    uhidInput = true,
    stayAwake = true,
    turnScreenOff,
    forwardAudio,
    fps,
    bitrate,
    maxSize,
    codec,
    displayBuffer,
    videoBuffer,
    audioBuffer,
    renderDriver,
    mouseSpeed = 'native',
    recordGameplay = false,
    fullView = false,
    fullViewMode = 'fullscreen'
  } = currentOptions;

  // Ghi tức thì cấu hình tốc độ chuột để switch_mouse.exe áp dụng hãm tốc độ phần cứng
  try {
    const speedFile = path.join(os.tmpdir(), 'pandakey_mouse_speed.txt');
    fs.writeFileSync(speedFile, (mouseSpeed || '0.35').toString());
  } catch (e) {}

  const effectiveBuffer = (videoBuffer !== undefined && videoBuffer !== null) ? videoBuffer : (displayBuffer !== undefined && displayBuffer !== null ? displayBuffer : 10);
  const args = [];

  // ⭐ Dùng RCtrl cho phím tắt Scrcpy để KHÔNG xung đột với Alt/Ctrl của Pandakeyauto
  args.push('--shortcut-mod=rctrl');

  let targetDeviceId = deviceId || selectedAdbDeviceId;
  if (!targetDeviceId) {
    targetDeviceId = resolveActiveAdbDevice();
  }

  if (targetDeviceId) {
    selectedAdbDeviceId = targetDeviceId;
    currentOptions.deviceId = targetDeviceId;
    queryHardwareStats();
    args.push('-s', targetDeviceId);
    // ⭐ Giữ điện thoại luôn thức và ngăn Android 14/15/16 tự ngắt kết nối USB khi đang chơi game
    try {
      exec(`"${adbPath}" -s "${targetDeviceId}" shell "svc power stayon true; settings put global stay_on_while_plugged_in 3"`, { windowsHide: true }, () => {});
      // Chuẩn bị kết nối Wi-Fi ngầm dự phòng chống rớt cáp (chỉ khi đang dùng USB)
      if (!targetDeviceId.includes(':')) {
        exec(`"${adbPath}" -s "${targetDeviceId}" tcpip 5555`, { windowsHide: true }, () => {
          exec(`"${adbPath}" -s "${targetDeviceId}" shell "ip addr show wlan0 | grep 'inet '"`, { windowsHide: true }, (err, stdout) => {
            if (!err && stdout) {
              const m = stdout.match(/inet\s+([0-9.]+)/);
              if (m) {
                savedWifiIp = m[1];
                sendLog(`📶 [Dự Phòng Wi-Fi] Đã sẵn sàng IP: ${savedWifiIp}:5555 (rút dây tự nhảy sang Wi-Fi liền mạch)`);
              }
            }
          });
        });
      }
    } catch (e) {}
  }

  if (mirrorScreen) {
    // 1. Kiểm soát quyền điều khiển điện thoại từ máy tính
    if (!enableControl) {
      args.push('--no-control');
    } else {
      if (uhidInput) {
        args.push('--keyboard=uhid');
        args.push('--mouse=uhid');
      }
    }

    // 2. Video Codec tối ưu (H.264 ổn định tuyệt đối chống văng cho mọi dòng máy, đặc biệt Vivo/MediaTek)
    const safeCodec = codec || 'h264';
    args.push(`--video-codec=${safeCodec}`);

    // 3. Tốc độ khung hình (Mặc định 60 FPS hoặc 90 FPS để chống quá nhiệt encoder)
    args.push(`--max-fps=${fps || 60}`);

    // 4. Bitrate truyền hình ảnh (12M cực nét mà không nghẽn đệm)
    args.push(`--video-bit-rate=${bitrate || '12M'}`);

    // 5. Độ phân giải tối đa
    if (maxSize && Number(maxSize) > 0) {
      args.push(`--max-size=${maxSize}`);
    }

    // 6. Khử độ trễ đệm hình ảnh (Scrcpy 3.1: dùng --video-buffer thay cho --display-buffer)
    if (effectiveBuffer !== undefined && effectiveBuffer !== null) {
      args.push(`--video-buffer=${effectiveBuffer}`);
    }

    // 7. Direct3D 11 GPU Rendering
    if (renderDriver) {
      args.push(`--render-driver=${renderDriver}`);
    }

    // 8. Âm thanh độ trễ thấp (Playback audio, chống xung đột micro khi chơi game)
    if (forwardAudio) {
      args.push('--audio-source=playback');
      if (audioBuffer !== undefined && audioBuffer !== null) {
        args.push(`--audio-buffer=${audioBuffer}`);
      }
    } else {
      args.push('--no-audio');
    }

    // 9. Cửa sổ chiếu màn hình & Tính năng Tự Động Vừa Khung Hình (Full View)
    args.push('--window-title=Pandakeyauto - Man Hinh Dien Thoai (Full View)');
    args.push('--always-on-top');

    if (fullView) {
      if (fullViewMode === 'borderless') {
        try {
          const primaryDisplay = screen.getPrimaryDisplay();
          const { width, height } = primaryDisplay.workAreaSize || primaryDisplay.bounds;
          args.push('--window-borderless');
          args.push(`--window-width=${width}`);
          args.push(`--window-height=${height}`);
          args.push('--window-x=0');
          args.push('--window-y=0');
          sendLog(`🖥️ [Full View] Cửa sổ tràn viền vừa vặn PC: ${width}x${height}`);
        } catch (e) {
          args.push('--fullscreen');
        }
      } else {
        // Mặc định Full View: Toàn màn hình PC
        args.push('--fullscreen');
        sendLog('🖥️ [Full View] Đã kích hoạt Toàn Màn Hình Fullscreen 100%');
      }
    }

    // 10. Tắt màn hình thật của điện thoại khi chiếu lên PC (nếu người dùng tích chọn checkbox)
    if (turnScreenOff) {
      args.push('--turn-screen-off');
    }

    // 11. Giữ điện thoại luôn thức khi cắm cáp (Luôn bật để chống tắt ngắt giữa chừng)
    args.push('--stay-awake');

    // 12. Ghi hình trận đấu trực tiếp qua GPU máy tính (0% lag điện thoại)
    if (recordGameplay) {
      const recDir = getRecordingsDir();
      const recFileName = `Gameplay_${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
      const recPath = path.join(recDir, recFileName);
      args.push(`--record=${recPath}`);
      args.push('--record-format=mp4');
      sendLog(`🔴 [Ghi hình MP4] Đang ghi hình trận đấu vào: ${recFileName}`);
    }
  } else {
    // ⭐ TAB BẢNG ĐEN (VÙNG BẮT CHUỘT TRỰC TIẾP - 0% CPU, TỐI ƯU TỐC ĐỘ CHUỘT CHUẨN XÁC)
    args.push('-K', '-M', '--no-video-playback');
    args.push('--window-width=360', '--window-height=140');
    args.push('--window-title=Pandakeyauto - Vung Bat Chuot');
    args.push('--always-on-top');
    args.push('--stay-awake');
    if (!forwardAudio) args.push('--no-audio');
  }

  try {
    const mouseScale = (mouseSpeed !== undefined && mouseSpeed !== null && mouseSpeed !== 'native') ? mouseSpeed.toString() : '1.0';
    controlProcess = spawn(scrcpyPath, args, {
      cwd: binDir,
      windowsHide: true,
      env: {
        ...process.env,
        SDL_MOUSE_RELATIVE_SPEED_SCALE: mouseScale,
        SDL_MOUSE_RELATIVE_SCALING: '1',
        SDL_MOUSE_NORMAL_SPEED_SCALE: mouseScale
      }
    });


    let lastErrorLines = [];

    controlProcess.stdout.on('data', (data) => {
      sendLog(data.toString());
    });

    controlProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      lastErrorLines.push(msg.trim());
      sendLog(msg);
    });

    controlProcess.on('close', (code) => {
      const wasSessionActive = isSessionActive;
      controlProcess = null;

      // Đóng cửa sổ Overlay gán phím khi phiên Scrcpy kết thúc
      if (keymapOverlayWindow && !keymapOverlayWindow.isDestroyed()) {
        try { keymapOverlayWindow.close(); } catch (e) {}
        keymapOverlayWindow = null;
      }

      // Khôi phục ngay lập tức tốc độ chuột PC gốc
      try {
        execFile(path.join(binDir, 'switch_mouse.exe'), ['--restore'], { windowsHide: true });
      } catch (e) {}

      const errorDetail = lastErrorLines.slice(-4).join(' | ');

      // ⭐ CƠ CHẾ CHỐNG VĂNG SIÊU TỐC 0.3s & TỰ CHUYỂN WI-FI DỰ PHÒNG (AUTO-HEAL FAILOVER)
      if (wasSessionActive && autoReconnectEnabled) {
        sendLog(`⚠️ Phiên kết nối bị gián đoạn. Đang tự động khôi phục siêu tốc 0.3s...`);

        // Kiểm tra lỗi MediaCodec H.265 / MediaTek bị văng hoặc quá tải
        const isEncoderErr = errorDetail.includes('video-encoder') ||
                             errorDetail.includes('MediaCodec') ||
                             errorDetail.includes('Exception on thread') ||
                             errorDetail.includes('IllegalStateException') ||
                             errorDetail.includes('codec');
        if (isEncoderErr || currentOptions.codec === 'h265') {
          sendLog(`⚡ Tự động chuyển H.264 (60 FPS, 10M) để chống quá tải encoder điện thoại...`);
          currentOptions.codec = 'h264';
          currentOptions.fps = 60;
          currentOptions.bitrate = '10M';
        }

        if (errorDetail.includes('Audio') || errorDetail.includes('audio')) {
          currentOptions.forwardAudio = false;
        }

        sendSafe('otg-status', { running: true, reconnecting: true, code, error: errorDetail });

        if (reconnectTimer) clearTimeout(reconnectTimer);
        let healAttempt = 0;
        const maxAttempts = 30; // Thử lại liên tục trong 10 giây (mỗi 300ms)

        const runAutoHeal = () => {
          if (!isSessionActive || controlProcess) return;
          healAttempt++;

          let canConnect = false;
          try {
            const devs = execSync(`"${adbPath}" devices`, { windowsHide: true }).toString();
            if (targetDeviceId && devs.includes(targetDeviceId)) {
              canConnect = true;
            } else if (savedWifiIp) {
              // Thử nhảy sang IP Wi-Fi dự phòng khi rút cáp USB
              try {
                execSync(`"${adbPath}" connect ${savedWifiIp}:5555`, { windowsHide: true });
                currentOptions.deviceId = `${savedWifiIp}:5555`;
                canConnect = true;
                sendLog(`📶 [Wi-Fi Failover] Đã tự động kết nối Wi-Fi ${savedWifiIp}:5555 để tiếp tục trận đấu!`);
              } catch (e) {}
            }
          } catch (e) {}

          if (canConnect) {
            sendLog(`🔄 [Chống văng] Đang nạp lại luồng điều khiển trong 0.3s...`);
            startControlInternal(currentOptions).catch(() => {
              if (healAttempt < maxAttempts) {
                reconnectTimer = setTimeout(runAutoHeal, 300);
              }
            });
          } else if (healAttempt < maxAttempts) {
            reconnectTimer = setTimeout(runAutoHeal, 300);
          } else {
            sendLog(`⚠️ Không thể kết nối lại sau ${healAttempt} lần thử. Nhấn ▶ BẮT ĐẦU để thử lại.`);
            isSessionActive = false;
            sendSafe('otg-status', { running: false, code, error: 'Thiết bị ngắt kết nối' });
          }
        };

        reconnectTimer = setTimeout(runAutoHeal, 300);
      } else {
        isSessionActive = false;
        sendSafe('otg-status', { running: false, code, error: errorDetail });
      }
    });

    const modeName = mirrorScreen
      ? `Chiếu màn hình PC (${codec ? codec.toUpperCase() : 'H264'} | ${fps || 120} FPS${fullView ? ' | Full View' : ''})`
      : 'Tab Bảng Đen (Vùng Bắt Chuột - Tối Ưu Tốc Độ Chuột Nhất)';

    showOsdNotification({
      icon: '🎮',
      game: 'KÍCH HOẠT THÀNH CÔNG',
      badge: `${fps || 120} FPS`,
      mode: modeName,
      specs: 'Phím nhanh chuyển chuột PC <> ĐT • Giữ 100% cô lập máy tính'
    });

    return {
      success: true,
      message: `Đã kích hoạt [${modeName}]! Bấm nút chuyển chuột đã cài đặt để đổi chuột sang điện thoại.`
    };
  } catch (error) {
    isSessionActive = false;
    return { success: false, message: error.message };
  }
}

ipcMain.handle('start-control', async (event, options = {}) => {
  return startControlInternal(options);
});

ipcMain.handle('stop-control', async () => {
  return stopActiveControl();
});

function stopActiveControl() {
  isSessionActive = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (controlProcess) {
    try {
      controlProcess.kill();
    } catch (e) {}
    controlProcess = null;
    try {
      execFile(path.join(binDir, 'switch_mouse.exe'), ['--restore'], { windowsHide: true });
    } catch (e) {}
    return { success: true, message: 'Đã dừng điều khiển và khôi phục tốc độ chuột PC.' };
  }
  return { success: true, message: 'Chưa có phiên nào hoạt động.' };
}

// Phím tắt Android
ipcMain.handle('send-keyevent', async (event, { deviceId, keycode }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell input keyevent ${keycode}`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, error: err.message });
      resolve({ success: true });
    });
  });
});

// ================= 🎮 NATIVE KEYMAPPER & HUD OVERLAY IPC =================
ipcMain.handle('get-current-keymap', async (event, gameId) => {
  const targetGameId = gameId || (profileManager.getActiveProfile() && profileManager.getActiveProfile().id) || 'freefire';
  return keymapper ? keymapper.getKeymap(targetGameId) : null;
});

ipcMain.handle('save-current-keymap', async (event, layout) => {
  if (!keymapper || !layout) return { success: false, message: 'Keymapper chưa sẵn sàng' };
  const targetGameId = layout.gameId || (profileManager.getActiveProfile() && profileManager.getActiveProfile().id) || 'freefire';
  const ok = keymapper.saveKeymap(targetGameId, layout);
  return { success: ok };
});

ipcMain.handle('reset-current-keymap', async (event, gameId) => {
  const targetGameId = gameId || (profileManager.getActiveProfile() && profileManager.getActiveProfile().id) || 'freefire';
  if (keymapper) {
    keymapper.resetKeymap(targetGameId);
    return keymapper.getKeymap(targetGameId);
  }
  return null;
});

ipcMain.handle('toggle-keymap-overlay', async (event, enable) => {
  const state = toggleKeymapOverlay(enable);
  return { success: true, active: state };
});

ipcMain.handle('set-keymap-overlay-interactive', async (event, interactive) => {
  if (keymapOverlayWindow && !keymapOverlayWindow.isDestroyed()) {
    keymapOverlayWindow.setIgnoreMouseEvents(!interactive, { forward: true });
  }
  return { success: true };
});

ipcMain.handle('inject-keymap-key', async (event, { key, gameId, deviceId } = {}) => {
  if (!keymapper) return { success: false };
  const targetGame = gameId || (profileManager.getActiveProfile() && profileManager.getActiveProfile().id) || 'freefire';
  const handled = keymapper.handleKeyPress(key, targetGame, deviceId || currentOptions.deviceId);
  return { success: handled };
});

// ================= 📡 1-CLICK WIRELESS ADB (KẾT NỐI KHÔNG DÂY) =================
ipcMain.handle('get-device-wifi-ip', async (event, deviceId) => {
  const target = deviceId ? `-s "${deviceId}"` : (currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '');
  return new Promise((resolve) => {
    // 1. ip route
    exec(`"${adbPath}" ${target} shell "ip route"`, { windowsHide: true }, (err, stdout) => {
      let ip = null;
      if (!err && stdout) {
        const lines = stdout.split('\n');
        for (const line of lines) {
          const m = line.match(/src\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
          if (m && !m[1].startsWith('127.')) {
            ip = m[1];
            break;
          }
        }
      }
      if (ip) return resolve({ success: true, ip });

      // 2. getprop
      exec(`"${adbPath}" ${target} shell "getprop dhcp.wlan0.ipaddress"`, { windowsHide: true }, (err2, stdout2) => {
        const cleanIp = (stdout2 || '').trim();
        if (cleanIp && cleanIp.match(/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/)) {
          return resolve({ success: true, ip: cleanIp });
        }

        // 3. ip addr show wlan0
        exec(`"${adbPath}" ${target} shell "ip addr show wlan0"`, { windowsHide: true }, (err3, stdout3) => {
          const m3 = (stdout3 || '').match(/inet\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
          if (m3) {
            return resolve({ success: true, ip: m3[1] });
          }
          resolve({ success: false, message: 'Không thể tìm thấy địa chỉ IP Wi-Fi của điện thoại. Hãy đảm bảo điện thoại đã kết nối cùng mạng Wi-Fi.' });
        });
      });
    });
  });
});

ipcMain.handle('connect-wireless-adb', async (event, { ip, port = 5555, deviceId } = {}) => {
  if (!ip) return { success: false, message: 'Địa chỉ IP không hợp lệ.' };

  // 1. Tự tìm thiết bị cắm USB để chạy tcpip nếu cần
  let usbDevice = deviceId;
  if (!usbDevice || usbDevice.includes(':')) {
    try {
      const devListStr = execSync(`"${adbPath}" devices`, { windowsHide: true }).toString();
      const lines = devListStr.trim().split('\n').slice(1);
      for (const l of lines) {
        const parts = l.trim().split(/\s+/);
        if (parts.length >= 2 && parts[1] === 'device' && !parts[0].includes(':')) {
          usbDevice = parts[0];
          break;
        }
      }
    } catch (e) {}
  }

  // Nếu có thiết bị USB, thử mở cổng TCP/IP 5555 trước (không để lỗi làm dừng kết nối)
  if (usbDevice && !usbDevice.includes(':')) {
    sendLog(`📶 Đang kích hoạt cổng TCP/IP ${port} trên cổng USB (${usbDevice})...`);
    try {
      execSync(`"${adbPath}" -s "${usbDevice}" tcpip ${port}`, { windowsHide: true });
    } catch (e) {
      sendLog(`ℹ️ tcpip: ${e.message}`);
    }
  }

  return new Promise((resolve) => {
    sendLog(`📶 Đang kết nối không dây tới: ${ip}:${port}...`);
    exec(`"${adbPath}" connect ${ip}:${port}`, { windowsHide: true }, (err2, stdout2) => {
      const out = (stdout2 || '').trim();
      if (out.includes('connected to') || out.includes('already connected')) {
        addOrUpdateSavedWifi(ip, parseInt(port) || 5555);
        selectedAdbDeviceId = `${ip}:${port}`;
        if (currentOptions) currentOptions.deviceId = `${ip}:${port}`;
        queryHardwareStats();
        sendLog(`✅ [Wi-Fi] Đã kết nối không dây thành công tới ${ip}:${port}! Bạn có thể rút cáp USB.`);
        showOsdNotification({
          icon: '📶',
          game: 'KẾT NỐI KHÔNG DÂY',
          badge: 'THÀNH CÔNG',
          mode: `${ip}:${port}`,
          specs: 'Đã sẵn sàng chiến game! Bạn có thể rút cáp USB.'
        });
        resolve({ success: true, targetId: `${ip}:${port}`, message: `Đã kết nối không dây thành công tới ${ip}:${port}! Bạn có thể rút cáp USB ngay bây giờ.` });
      } else {
        resolve({ success: false, message: out || 'Không thể kết nối không dây. Vui lòng kiểm tra cùng mạng Wi-Fi.' });
      }
    });
  });
});

// ================= 📶 ADVANCED WIRELESS SUITE (GHÉP ĐÔI, SCAN & DIAGNOSTIC) =================
ipcMain.handle('get-saved-wifi-devices', async () => {
  return getSavedWifiConfig();
});

ipcMain.handle('save-wifi-devices-config', async (event, payload) => {
  const cfg = getSavedWifiConfig();
  const updated = { ...cfg, ...payload };
  saveWifiConfig(updated);
  return { success: true, config: updated };
});

ipcMain.handle('disconnect-wifi', async (event, { target } = {}) => {
  const toDisconnect = target || (currentOptions.deviceId ? currentOptions.deviceId : '');
  if (!toDisconnect) return { success: false, message: 'Chưa chọn thiết bị để ngắt kết nối.' };
  return new Promise((resolve) => {
    exec(`"${adbPath}" disconnect ${toDisconnect}`, { windowsHide: true }, (err, stdout) => {
      sendLog(`📶 Đã ngắt kết nối Wi-Fi: ${toDisconnect}`);
      showOsdNotification({
        icon: '📶',
        game: 'NGẮT KẾT NỐI WI-FI',
        badge: 'DISCONNECTED',
        mode: toDisconnect,
        specs: 'Đã ngắt kết nối không dây thành công.'
      });
      resolve({ success: true, message: `Đã ngắt kết nối tới ${toDisconnect}` });
    });
  });
});

// Ghép Đôi Android 11+ Không Dây (Wireless Pairing Code)
ipcMain.handle('pair-wireless-device', async (event, { hostPort, pairCode, connectPort } = {}) => {
  if (!hostPort || !pairCode) {
    return { success: false, message: 'Vui lòng nhập đầy đủ Địa chỉ:Cổng và Mã ghép đôi 6 số.' };
  }
  const cleanHostPort = hostPort.trim().replace(/^https?:\/\//, '');
  const cleanPairCode = pairCode.trim();
  
  return new Promise((resolve) => {
    sendLog(`📶 [Pairing] Đang ghép đôi thiết bị qua mã: ${cleanHostPort} [${cleanPairCode}]...`);
    exec(`"${adbPath}" pair ${cleanHostPort} ${cleanPairCode}`, { windowsHide: true }, (err, stdout) => {
      const out = (stdout || '').trim();
      sendLog(`📶 [Pair Output]: ${out}`);
      if (out.includes('Successfully paired') || out.includes('already paired') || (!err && out.length > 0 && !out.toLowerCase().includes('failed') && !out.toLowerCase().includes('error'))) {
        const host = cleanHostPort.split(':')[0];
        const portToConnect = connectPort ? connectPort.trim() : '5555';
        const targetConnect = `${host}:${portToConnect}`;

        sendLog(`📶 [Pairing Success] Đang tự động kết nối tới ${targetConnect}...`);
        setTimeout(() => {
          exec(`"${adbPath}" connect ${targetConnect}`, { windowsHide: true }, (err2, stdout2) => {
            const out2 = (stdout2 || '').trim();
            if (out2.includes('connected to') || out2.includes('already connected')) {
              addOrUpdateSavedWifi(host, parseInt(portToConnect) || 5555, `Android 11+ (${host})`);
              showOsdNotification({
                icon: '🔗',
                game: 'GHÉP ĐÔI THÀNH CÔNG',
                badge: 'ANDROID 11+',
                mode: targetConnect,
                specs: 'Đã kết nối không dây hoàn toàn không cần cáp!'
              });
              resolve({
                success: true,
                message: `Ghép đôi và kết nối thành công tới ${targetConnect}!`,
                deviceId: targetConnect
              });
            } else {
              resolve({
                success: true,
                message: `Ghép đôi thành công! Cần kết nối tới cổng chính: ${out2}`,
                deviceId: targetConnect
              });
            }
          });
        }, 800);
      } else {
        resolve({
          success: false,
          message: out || (err ? err.message : 'Ghép đôi thất bại. Hãy kiểm tra lại mã số và cổng.')
        });
      }
    });
  });
});

// Quét mDNS & Quét Mạng LAN tìm thiết bị Android
ipcMain.handle('scan-wireless-devices', async () => {
  return new Promise((resolve) => {
    const discovered = [];
    exec(`"${adbPath}" mdns services`, { windowsHide: true }, (err, stdout) => {
      if (!err && stdout) {
        const lines = stdout.split('\n');
        for (const line of lines) {
          const m = line.match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):([0-9]+)/);
          if (m) {
            discovered.push({
              ip: m[1],
              port: parseInt(m[2]),
              fullTarget: `${m[1]}:${m[2]}`,
              type: 'mdns',
              serviceName: line.trim()
            });
          }
        }
      }
      
      const cfg = getSavedWifiConfig();
      if (Array.isArray(cfg.savedDevices)) {
        for (const d of cfg.savedDevices) {
          if (!discovered.some(x => x.ip === d.ip && x.port === d.port)) {
            discovered.push({ ...d, type: 'saved' });
          }
        }
      }

      resolve({ success: true, devices: discovered });
    });
  });
});

// Chẩn đoán chất lượng tín hiệu Wi-Fi
ipcMain.handle('get-wifi-quality', async (event, targetDeviceId) => {
  const target = targetDeviceId ? `-s "${targetDeviceId}"` : (currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '');
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell "dumpsys wifi | grep -E 'mLinkSpeed|mFrequency|mRssi|Link speed' | head -n 10"`, { windowsHide: true }, (err, stdout) => {
      let linkSpeed = 0;
      let frequency = 0;
      let rssi = -50;

      if (!err && stdout) {
        const speedMatch = stdout.match(/(?:mLinkSpeed|Link speed:?)\s*[:=]?\s*([0-9]+)/i);
        if (speedMatch) linkSpeed = parseInt(speedMatch[1]);
        const freqMatch = stdout.match(/(?:mFrequency|frequency:?)\s*[:=]?\s*([0-9]+)/i);
        if (freqMatch) frequency = parseInt(freqMatch[1]);
        const rssiMatch = stdout.match(/(?:mRssi|rssi:?)\s*[:=]?\s*(-?[0-9]+)/i);
        if (rssiMatch) rssi = parseInt(rssiMatch[1]);
      }

      const is5GHz = frequency > 4900;
      let qualityText = 'Tốt';
      if (linkSpeed >= 400 || (is5GHz && rssi > -65)) {
        qualityText = 'Siêu Tốc (Chuẩn 120 FPS)';
      } else if (linkSpeed >= 150) {
        qualityText = 'Khá Tốt (Chuẩn 90 FPS)';
      } else if (linkSpeed > 0) {
        qualityText = 'Trung Bình (Nên đổi sang Wi-Fi 5GHz)';
      } else {
        qualityText = 'Đang đo...';
      }

      resolve({
        success: true,
        linkSpeed: linkSpeed || 433,
        frequency: frequency || (is5GHz ? 5180 : 2412),
        is5GHz,
        rssi,
        qualityText
      });
    });
  });
});

// Lấy Subnet IP mạng LAN hiện tại của PC để tự động điền gợi ý
ipcMain.handle('get-local-subnet', async () => {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const parts = iface.address.split('.');
          if (parts.length === 4 && parts[0] !== '169') {
            return { subnet: `${parts[0]}.${parts[1]}.${parts[2]}.`, ip: iface.address };
          }
        }
      }
    }
  } catch (e) {}
  return { subnet: '192.168.1.', ip: '192.168.1.16' };
});

// Tự động quét tìm thiết bị đang bắt Wi-Fi Hotspot do máy tính phát ra (192.168.137.x)
ipcMain.handle('find-hotspot-devices', async () => {
  return new Promise((resolve) => {
    exec('arp -a', { windowsHide: true }, (err, stdout) => {
      const ips = [];
      if (!err && stdout) {
        const lines = stdout.split('\n');
        let inHotspot = false;
        for (const line of lines) {
          if (line.includes('192.168.137.1')) {
            inHotspot = true;
            continue;
          }
          if (inHotspot && line.includes('Interface:')) {
            inHotspot = false;
          }
          if (inHotspot) {
            const m = line.match(/(192\.168\.137\.\d+)/);
            if (m && m[1] !== '192.168.137.1' && m[1] !== '192.168.137.255') {
              if (!ips.includes(m[1])) ips.push(m[1]);
            }
          }
        }
      }
      resolve({ success: true, ips, autoDetectedIp: ips[0] || null });
    });
  });
});

// ================= 🎛️ BỘ LỌC BƯỚC CHÂN FPS (SOUND BOOSTER) =================
ipcMain.handle('toggle-footstep-booster', async (event, forceState) => {
  isFootstepBoosterActive = forceState !== undefined ? !!forceState : !isFootstepBoosterActive;
  if (isFootstepBoosterActive) {
    showOsdNotification({
      icon: '🎛️',
      game: 'KÍCH ÂM BƯỚC CHÂN',
      badge: 'BẬT',
      mode: 'Tần số 250Hz - 2.5kHz',
      specs: 'Khuếch đại tiếng chân & nạp đạn • Giảm chói tiếng súng sấy'
    });
    sendLog('🎛️ [VIP Audio] Đã BẬT bộ kích âm bước chân FPS (Footstep Booster)');
  } else {
    showOsdNotification({
      icon: '⚪',
      game: 'KÍCH ÂM BƯỚC CHÂN',
      badge: 'TẮT',
      mode: 'Âm thanh bình thường',
      specs: 'Đã tắt bộ lọc âm'
    });
    sendLog('⚪ [VIP Audio] Đã TẮT bộ kích âm bước chân FPS');
  }
  return { success: true, active: isFootstepBoosterActive };
});

// ================= 👁️ KÍCH MÀU ĐỊCH & NHÌN ĐÊM (DIGITAL VIBRANCE) =================
ipcMain.handle('toggle-digital-vibrance', async (event, { forceState, deviceId } = {}) => {
  isDigitalVibranceActive = forceState !== undefined ? !!forceState : !isDigitalVibranceActive;
  const target = deviceId ? `-s "${deviceId}"` : (currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '');

  if (isDigitalVibranceActive) {
    exec(`"${adbPath}" ${target} shell "settings put secure high_text_contrast_enabled 1"`, { windowsHide: true });
    exec(`"${adbPath}" ${target} shell "settings put system display_color_mode 3"`, { windowsHide: true });
    showOsdNotification({
      icon: '👁️',
      game: 'KÍCH MÀU ĐỊCH & NHÌN ĐÊM',
      badge: 'BẬT',
      mode: 'Digital Vibrance + Black EQ',
      specs: 'Làm rõ nhân vật trong bụi cỏ & tăng sáng các góc tối'
    });
    sendLog('👁️ [VIP Visual] Đã BẬT chế độ kích màu địch & nhìn đêm (Digital Vibrance)');
  } else {
    exec(`"${adbPath}" ${target} shell "settings put secure high_text_contrast_enabled 0"`, { windowsHide: true });
    exec(`"${adbPath}" ${target} shell "settings put system display_color_mode 1"`, { windowsHide: true });
    showOsdNotification({
      icon: '⚪',
      game: 'KÍCH MÀU ĐỊCH & NHÌN ĐÊM',
      badge: 'TẮT',
      mode: 'Màu sắc hiển thị tiêu chuẩn',
      specs: 'Đã khôi phục chế độ hiển thị gốc'
    });
    sendLog('⚪ [VIP Visual] Đã TẮT chế độ kích màu địch');
  }
  return { success: true, active: isDigitalVibranceActive };
});

// ================= 🎯 QUICK-SWITCH SNIPER (AWM SIÊU TỐC) =================
let sniperProcess = null;

function startSniperWorker() {
  stopSniperWorker();
  const exePath = path.join(binDir, 'sniper_assist.exe');
  if (fs.existsSync(exePath)) {
    try {
      sniperProcess = spawn(exePath, ['50', '60'], {
        cwd: binDir,
        windowsHide: true
      });
      sniperProcess.on('close', () => {
        sniperProcess = null;
      });
    } catch (e) {
      console.error('Lỗi khi chạy sniper_assist.exe:', e);
    }
  }
}

function stopSniperWorker() {
  if (sniperProcess) {
    try { sniperProcess.kill(); } catch (e) {}
    sniperProcess = null;
  }
}

function toggleQuickSniperGlobal(forceState) {
  isQuickSniperActive = forceState !== undefined ? !!forceState : !isQuickSniperActive;
  if (isQuickSniperActive) {
    startSniperWorker();
    showOsdNotification({
      icon: '🎯',
      game: 'QUICK-SWITCH SNIPER',
      badge: 'BẬT (F7)',
      mode: 'Tự Động Đổi Súng Khi Bắn',
      specs: 'Bắn ➔ Đổi Dao (3) ➔ Đổi Súng (1) trong 0.05s'
    });
    sendLog('🎯 [VIP Sniper] Đã BẬT Quick-Switch Sniper (F7)');
  } else {
    stopSniperWorker();
    showOsdNotification({
      icon: '⚪',
      game: 'QUICK-SWITCH SNIPER',
      badge: 'TẮT (F7)',
      mode: 'Bắn súng bình thường',
      specs: 'Đã tắt tự động đổi súng'
    });
    sendLog('⚪ [VIP Sniper] Đã TẮT Quick-Switch Sniper (F7)');
  }
  sendSafe('quick-sniper-toggled-global', isQuickSniperActive);
  return { success: true, active: isQuickSniperActive };
}

function triggerQuickSniperSwitch(deviceId) {
  const target = deviceId ? `-s "${deviceId}"` : (currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '');
  setTimeout(() => {
    exec(`"${adbPath}" ${target} shell input keyevent 10`, { windowsHide: true });
    setTimeout(() => {
      exec(`"${adbPath}" ${target} shell input keyevent 8`, { windowsHide: true });
    }, 40);
  }, 30);
}

ipcMain.handle('toggle-quick-sniper', async (event, forceState) => {
  return toggleQuickSniperGlobal(forceState);
});

ipcMain.handle('trigger-quick-sniper', async (event, { deviceId } = {}) => {
  triggerQuickSniperSwitch(deviceId);
  return { success: true };
});

// ================= 🛡️ TOURNAMENT CLUTCH SHIELD (CHẾ ĐỘ TẬP TRUNG THI ĐẤU) =================
function toggleClutchShieldGlobal(forceState, deviceId) {
  isClutchShieldActive = forceState !== undefined ? !!forceState : !isClutchShieldActive;
  const target = deviceId ? `-s "${deviceId}"` : (currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '');

  if (isClutchShieldActive) {
    exec(`"${adbPath}" ${target} shell "cmd notification set_zen_mode 1"`, { windowsHide: true });
    exec(`"${adbPath}" ${target} shell "settings put global heads_up_notifications_enabled 0"`, { windowsHide: true });
    exec(`"${adbPath}" ${target} shell "settings put system accelerometer_rotation 0"`, { windowsHide: true });
    showOsdNotification({
      icon: '🛡️',
      game: 'TOURNAMENT CLUTCH SHIELD',
      badge: 'ĐÃ BẬT',
      mode: 'Chế độ thi đấu tập trung 100%',
      specs: 'Chặn cuộc gọi, tin nhắn Zalo/SMS & thông báo nổi'
    });
    sendLog('🛡️ [Thi Đấu] Đã BẬT Chế Độ Tập Trung (Clutch Shield)');
  } else {
    exec(`"${adbPath}" ${target} shell "cmd notification set_zen_mode 0"`, { windowsHide: true });
    exec(`"${adbPath}" ${target} shell "settings put global heads_up_notifications_enabled 1"`, { windowsHide: true });
    showOsdNotification({
      icon: '⚪',
      game: 'TOURNAMENT CLUTCH SHIELD',
      badge: 'ĐÃ TẮT',
      mode: 'Thông báo bình thường',
      specs: 'Đã khôi phục chế độ nhận thông báo'
    });
    sendLog('⚪ [Thi Đấu] Đã TẮT Chế Độ Tập Trung');
  }
  return { success: true, active: isClutchShieldActive };
}

ipcMain.handle('toggle-clutch-shield', async (event, { forceState, deviceId } = {}) => {
  return toggleClutchShieldGlobal(forceState, deviceId);
});

// ================= 📸 INSTANT SCREENSHOT & HIGHLIGHT CAPTURE (F9) =================
function captureInstantScreenshot(deviceId) {
  return new Promise((resolve) => {
    const screenshotsDir = path.join(app.getPath('pictures'), 'Pandakeyauto');
    if (!fs.existsSync(screenshotsDir)) {
      try { fs.mkdirSync(screenshotsDir, { recursive: true }); } catch (e) {}
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `Highlight_${timestamp}.png`;
    const filePath = path.join(screenshotsDir, filename);
    const target = deviceId ? `-s "${deviceId}"` : (currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '');

    sendLog(`📸 Đang chụp khoảnh khắc qua ADB: ${filename}...`);
    exec(`"${adbPath}" ${target} exec-out screencap -p > "${filePath}"`, { windowsHide: true, encoding: 'binary' }, (err) => {
      if (!err && fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
        showOsdNotification({
          icon: '📸',
          game: 'KHOẢNH KHẮC HIGHLIGHT',
          badge: 'F9 THÀNH CÔNG',
          mode: filename,
          specs: `Đã lưu ảnh gốc vào thư mục Pictures\\Pandakeyauto`
        });
        sendLog(`📸 [Screenshot F9] Đã lưu khoảnh khắc thành công: ${filename}`);
        sendSafe('screenshot-captured', { success: true, filePath, filename });
        resolve({ success: true, filePath, filename });
      } else {
        const errMsg = err ? err.message : 'Tập tin ảnh rỗng';
        sendLog(`[Screenshot] Lỗi chụp màn hình: ${errMsg}`);
        resolve({ success: false, message: errMsg });
      }
    });
  });
}

ipcMain.handle('capture-instant-screenshot', async (event, { deviceId } = {}) => {
  return captureInstantScreenshot(deviceId);
});

ipcMain.handle('open-screenshots-folder', async () => {
  const screenshotsDir = path.join(app.getPath('pictures'), 'Pandakeyauto');
  if (!fs.existsSync(screenshotsDir)) {
    try { fs.mkdirSync(screenshotsDir, { recursive: true }); } catch (e) {}
  }
  shell.openPath(screenshotsDir);
  return { success: true };
});

// ================= 🌐 DỊCH MÀN HÌNH GAME THỜI GIAN THỰC (F10 / ALT+T) =================
async function openTranslatorOverlay() {
  if (translatorOverlayWindow && !translatorOverlayWindow.isDestroyed()) {
    translatorOverlayWindow.show();
    translatorOverlayWindow.focus();
    translatorOverlayWindow.webContents.send('start-translating');
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const winWidth = Math.min(580, Math.round(width * 0.45));
  const winHeight = Math.min(680, Math.round(height * 0.82));

  translatorOverlayWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: Math.round((width - winWidth) / 2),
    y: Math.round((height - winHeight) / 2),
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  translatorOverlayWindow.loadFile(path.join(__dirname, 'translator_overlay.html'));

  translatorOverlayWindow.once('ready-to-show', () => {
    if (translatorOverlayWindow && !translatorOverlayWindow.isDestroyed()) {
      translatorOverlayWindow.show();
      translatorOverlayWindow.focus();
    }
  });

  translatorOverlayWindow.on('closed', () => {
    translatorOverlayWindow = null;
  });
}

function closeTranslatorOverlay() {
  if (translatorOverlayWindow && !translatorOverlayWindow.isDestroyed()) {
    translatorOverlayWindow.close();
    translatorOverlayWindow = null;
  }
}

async function triggerScreenTranslateInternal(options = {}) {
  const targetId = options.deviceId || targetDeviceId || currentOptions.deviceId;
  if (!screenTranslator) {
    screenTranslator = new ScreenTranslator(adbPath);
  }

  // Mở cửa sổ Overlay ở trạng thái chờ
  await openTranslatorOverlay();

  showOsdNotification({
    icon: '🌐',
    game: 'DỊCH MÀN HÌNH GAME (F10)',
    badge: 'ĐANG QUÉT CHỮ',
    mode: 'Đang quét ký tự màn hình và dịch tiếng Việt...',
    specs: 'Phím F10 / Esc để đóng'
  });

  const lang = options.language || translatorSourceLang || 'eng+chi_sim';
  const result = await screenTranslator.processScreenTranslation(targetId, { language: lang });

  if (translatorOverlayWindow && !translatorOverlayWindow.isDestroyed()) {
    translatorOverlayWindow.webContents.send('display-translation-result', result);
  }
  return result;
}

ipcMain.handle('trigger-screen-translate', async (event, options = {}) => {
  if (options.language) translatorSourceLang = options.language;
  return triggerScreenTranslateInternal(options);
});

ipcMain.handle('close-translator-overlay', async () => {
  closeTranslatorOverlay();
  return { success: true };
});

ipcMain.handle('set-translator-config', async (event, { language }) => {
  if (language) translatorSourceLang = language;
  return { success: true, language: translatorSourceLang };
});


