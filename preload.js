const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getDevices: () => ipcRenderer.invoke('get-devices'),
  restartAdb: () => ipcRenderer.invoke('restart-adb'),
  connectWifi: (payload) => ipcRenderer.invoke('connect-wifi', payload),
  activatePanda: (payload) => ipcRenderer.invoke('activate-panda', payload),
  takeScreenshot: (payload) => ipcRenderer.invoke('take-screenshot', payload),
  sendTextToPhone: (payload) => ipcRenderer.invoke('send-text-to-phone', payload),
  openUrlOnPhone: (payload) => ipcRenderer.invoke('open-url-on-phone', payload),
  startControl: (options) => ipcRenderer.invoke('start-control', options),
  stopControl: () => ipcRenderer.invoke('stop-control'),
  setMouseSpeed: (speed) => ipcRenderer.invoke('set-mouse-speed', speed),
  getSwitchKey: () => ipcRenderer.invoke('get-switch-key'),
  setSwitchKey: (key) => ipcRenderer.invoke('set-switch-key', key),
  sendKeyEvent: (payload) => ipcRenderer.invoke('send-keyevent', payload),

  // Profile & Game Mode APIs
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  setActiveProfile: (profileId) => ipcRenderer.invoke('set-active-profile', profileId),
  setActiveMode: (payload) => ipcRenderer.invoke('set-active-mode', payload),
  nextMode: () => ipcRenderer.invoke('next-mode'),
  prevMode: () => ipcRenderer.invoke('prev-mode'),
  updateModeOptions: (options) => ipcRenderer.invoke('update-mode-options', options),
  addProfile: (profileData) => ipcRenderer.invoke('add-profile', profileData),
  deleteProfile: (profileId) => ipcRenderer.invoke('delete-profile', profileId),
  updateProfile: (payload) => ipcRenderer.invoke('update-profile', payload),
  exportProfiles: () => ipcRenderer.invoke('export-profiles'),
  importProfiles: (data) => ipcRenderer.invoke('import-profiles', data),
  onModeChanged: (callback) => ipcRenderer.on('mode-changed', (_event, value) => callback(value)),

  // GitHub Gist Sync APIs
  syncGithubUpload: (payload) => ipcRenderer.invoke('sync-github-upload', payload),
  syncGithubDownload: (payload) => ipcRenderer.invoke('sync-github-download', payload),
  getGithubConfig: () => ipcRenderer.invoke('get-github-config'),
  saveGithubConfig: (payload) => ipcRenderer.invoke('save-github-config', payload),

  // VIP Crosshair & Phone Cooler APIs
  toggleCrosshair: (enabled) => ipcRenderer.invoke('toggle-crosshair', enabled),
  updateCrosshair: (config) => ipcRenderer.invoke('update-crosshair', config),
  togglePhoneCooler: (payload) => ipcRenderer.invoke('toggle-phone-cooler', payload),

  // VIP Game Booster & Rapid Fire Macro APIs
  boostDevice: (payload) => ipcRenderer.invoke('boost-device', payload),
  restoreDeviceAnim: (payload) => ipcRenderer.invoke('restore-device-anim', payload),
  toggleRapidFire: (payload) => ipcRenderer.invoke('toggle-rapid-fire', payload),

  // 🎯 Recoil Control System APIs
  toggleRecoil: (payload) => ipcRenderer.invoke('toggle-recoil', payload),
  updateRecoilConfig: (payload) => ipcRenderer.invoke('update-recoil-config', payload),

  // 📱 iPad Screen View (4:3) APIs
  setIpadView: (payload) => ipcRenderer.invoke('set-ipad-view', payload),
  resetIpadView: (payload) => ipcRenderer.invoke('reset-ipad-view', payload),

  // 🔁 Auto Farm / Touch Macro Recorder APIs
  startMacroRecord: () => ipcRenderer.invoke('start-macro-record'),
  stopMacroRecord: () => ipcRenderer.invoke('stop-macro-record'),
  playMacro: (payload) => ipcRenderer.invoke('play-macro', payload),
  stopMacroPlay: () => ipcRenderer.invoke('stop-macro-play'),

  // 🔋 Hardware & Battery HUD APIs
  getBatteryInfo: (payload) => ipcRenderer.invoke('get-battery-info', payload),
  toggleBypassCharging: (payload) => ipcRenderer.invoke('toggle-bypass-charging', payload),
  setRefreshRate: (payload) => ipcRenderer.invoke('set-refresh-rate', payload),

  // 📦 File Drag & Drop & Wireless ADB APIs
  installApk: (payload) => ipcRenderer.invoke('install-apk', payload),
  pushFileToPhone: (payload) => ipcRenderer.invoke('push-file-to-phone', payload),
  activateWirelessAdb: (payload) => ipcRenderer.invoke('activate-wireless-adb', payload),

  // 🎥 Streamer & Content Creator APIs
  toggleShowTouches: (payload) => ipcRenderer.invoke('toggle-show-touches', payload),
  openRecordingsFolder: () => ipcRenderer.invoke('open-recordings-folder'),

  // 🎨 Combat Assist & Color Aim / Filter APIs
  toggleColorAssist: (payload) => ipcRenderer.invoke('toggle-color-assist', payload),
  updateColorAssistConfig: (payload) => ipcRenderer.invoke('update-color-assist-config', payload),

  // 🎮 Native Keymapper & HUD Overlay APIs (Panda-Style Không Cần App Thứ 3)
  getCurrentKeymap: (gameId) => ipcRenderer.invoke('get-current-keymap', gameId),
  saveCurrentKeymap: (layout) => ipcRenderer.invoke('save-current-keymap', layout),
  resetCurrentKeymap: (gameId) => ipcRenderer.invoke('reset-current-keymap', gameId),
  toggleKeymapOverlay: (enable) => ipcRenderer.invoke('toggle-keymap-overlay', enable),
  setKeymapOverlayInteractive: (interactive) => ipcRenderer.invoke('set-keymap-overlay-interactive', interactive),
  injectKeymapKey: (payload) => ipcRenderer.invoke('inject-keymap-key', payload),

  // 📶 1-Click Wireless ADB APIs
  getDeviceWifiIp: (deviceId) => ipcRenderer.invoke('get-device-wifi-ip', deviceId),
  connectWirelessAdb: (payload) => ipcRenderer.invoke('connect-wireless-adb', payload),

  // 🎛️ Footstep Booster & 👁️ Digital Vibrance APIs
  toggleFootstepBooster: (forceState) => ipcRenderer.invoke('toggle-footstep-booster', forceState),
  toggleDigitalVibrance: (payload) => ipcRenderer.invoke('toggle-digital-vibrance', payload),

  // 🎯 Quick-Switch Sniper & 🛡️ Clutch Shield APIs
  toggleQuickSniper: (forceState) => ipcRenderer.invoke('toggle-quick-sniper', forceState),
  triggerQuickSniper: (payload) => ipcRenderer.invoke('trigger-quick-sniper', payload),
  toggleClutchShield: (payload) => ipcRenderer.invoke('toggle-clutch-shield', payload),

  // 📸 Instant Screenshot APIs
  captureInstantScreenshot: (payload) => ipcRenderer.invoke('capture-instant-screenshot', payload),
  openScreenshotsFolder: () => ipcRenderer.invoke('open-screenshots-folder'),

  // Core Events
  onRequestStartControl: (callback) => ipcRenderer.on('request-start-control', () => callback()),
  onOtgLog: (callback) => ipcRenderer.on('otg-log', (_event, value) => callback(value)),
  onOtgStatus: (callback) => ipcRenderer.on('otg-status', (_event, value) => callback(value)),
  onRecoilToggled: (callback) => ipcRenderer.on('recoil-toggled-global', (_event, value) => callback(value)),
  onQuickSniperToggled: (callback) => ipcRenderer.on('quick-sniper-toggled-global', (_event, value) => callback(value)),
  onScreenshotCaptured: (callback) => ipcRenderer.on('screenshot-captured', (_event, value) => callback(value))
});
