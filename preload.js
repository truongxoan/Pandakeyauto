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

  // Window Controls (Mini HUD ~200x200 & Orb Mode)
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  toggleWindowSize: (size) => ipcRenderer.invoke('toggle-window-size', size),
  toggleOrbMode: () => ipcRenderer.invoke('toggle-orb-mode'),
  setWindowOpacity: (opacity) => ipcRenderer.invoke('set-window-opacity', opacity),

  // Gaming Precision & Automation APIs
  setMouseRatioY: (ratio) => ipcRenderer.invoke('set-mouse-ratio-y', ratio),
  toggleCursorLock: (enabled) => ipcRenderer.invoke('toggle-cursor-lock', enabled),

  // VIP Phone Cooler APIs
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

  // 📱 21:9 UltraWide & iPad Screen View APIs
  setIpadView: (payload) => ipcRenderer.invoke('set-ipad-view', payload),
  resetIpadView: (payload) => ipcRenderer.invoke('reset-ipad-view', payload),
  getDisplayResolution: (payload) => ipcRenderer.invoke('get-display-resolution', payload),

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

  // 📶 1-Click Wireless ADB & Advanced Wireless Suite APIs
  getDeviceWifiIp: (deviceId) => ipcRenderer.invoke('get-device-wifi-ip', deviceId),
  connectWirelessAdb: (payload) => ipcRenderer.invoke('connect-wireless-adb', payload),
  pairWirelessDevice: (payload) => ipcRenderer.invoke('pair-wireless-device', payload),
  disconnectWifi: (payload) => ipcRenderer.invoke('disconnect-wifi', payload),
  scanWirelessDevices: () => ipcRenderer.invoke('scan-wireless-devices'),
  getSavedWifiDevices: () => ipcRenderer.invoke('get-saved-wifi-devices'),
  saveWifiDevicesConfig: (payload) => ipcRenderer.invoke('save-wifi-devices-config', payload),
  getWifiQuality: (deviceId) => ipcRenderer.invoke('get-wifi-quality', deviceId),
  getLocalSubnet: () => ipcRenderer.invoke('get-local-subnet'),
  findHotspotDevices: () => ipcRenderer.invoke('find-hotspot-devices'),

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

  // 🌐 Screen Translator APIs (F10 / Alt+T)
  triggerScreenTranslate: (options) => ipcRenderer.invoke('trigger-screen-translate', options),
  closeTranslatorOverlay: () => ipcRenderer.invoke('close-translator-overlay'),
  setTranslatorConfig: (config) => ipcRenderer.invoke('set-translator-config', config),

  setSelectedDevice: (deviceId) => ipcRenderer.invoke('set-selected-device', deviceId),
  pollHardwareStats: () => ipcRenderer.invoke('poll-hardware-stats'),

  // Core Events
  onRequestStartControl: (callback) => ipcRenderer.on('request-start-control', () => callback()),
  onOtgLog: (callback) => ipcRenderer.on('otg-log', (_event, value) => callback(value)),
  onOtgStatus: (callback) => ipcRenderer.on('otg-status', (_event, value) => callback(value)),
  onRecoilToggled: (callback) => ipcRenderer.on('recoil-toggled-global', (_event, value) => callback(value)),
  onQuickSniperToggled: (callback) => ipcRenderer.on('quick-sniper-toggled-global', (_event, value) => callback(value)),
  onScreenshotCaptured: (callback) => ipcRenderer.on('screenshot-captured', (_event, value) => callback(value)),
  onGameAutoDetected: (callback) => ipcRenderer.on('game-auto-detected', (_event, value) => callback(value)),
  onHardwareStats: (callback) => ipcRenderer.on('hardware-stats', (_event, value) => callback(value)),
  onToggleOrb: (callback) => ipcRenderer.on('trigger-toggle-orb', () => callback())
});
