let currentDeviceId = null;
let preferredConnectionMode = localStorage.getItem('pandakey_pref_conn_mode') || 'usb';
let lockedDeviceId = localStorage.getItem('pandakey_locked_device_id') || null;
let isControlling = false;
let profilesData = null;
let activeProfile = null;
let activeMode = null;

let isCoolerActive = false;
let isRapidFireActive = false;

// Multi-device & VIP Elements
const elSelDeviceList = document.getElementById('selDeviceList');
const elBtnBoostDevice = document.getElementById('btnBoostDevice');
const elBtnRestoreAnim = document.getElementById('btnRestoreAnim');
const elBtnToggleRapidFire = document.getElementById('btnToggleRapidFire');
const elSelRapidCps = document.getElementById('selRapidCps');

// Audio Synthesizer cho hiệu ứng âm thanh VIP khi đổi chế độ
const audioCtx = (typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined')
  ? new (window.AudioContext || window.webkitAudioContext)()
  : null;

function playSoundCue(type = 'mode') {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'mode') {
      // 2 nốt beep êm ái báo đổi chế độ thành công
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.08); // A5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'activate') {
      // Âm thanh kích hoạt công nghệ
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {}
}

// Elements
const elStatusDot = document.getElementById('statusDot');
const elDeviceText = document.getElementById('deviceText');
const elFooterLog = document.getElementById('footerLog');

// Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-content');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const targetId = btn.getAttribute('data-tab');
    const targetPane = document.getElementById(targetId);
    if (targetPane) targetPane.classList.add('active');
  });
});

// Sub-Tabs trong Tab 1 (Chiến Game)
window.switchSubTab = function(targetId) {
  if (!targetId) return;
  const subBtns = document.querySelectorAll('.sub-tab-btn');
  const subPanes = document.querySelectorAll('.sub-tab-pane');
  subBtns.forEach(b => {
    if (b.getAttribute('data-subtab') === targetId) b.classList.add('active');
    else b.classList.remove('active');
  });
  subPanes.forEach(p => {
    if (p.id === targetId) p.classList.add('active');
    else p.classList.remove('active');
  });
  playSoundCue('mode');
  const tabNames = {
    'subtabTuning': '⚙️ 1. Thông Số & Chuột',
    'subtabControls': '🛡️ 2. Chế Độ & Tính Năng',
    'subtabCombatVip': '🎯 3. Chiến Thuật VIP (Ghìm Tâm, iPad 4:3, Macro)'
  };
  updateFooterLog(`Đã chuyển tab: ${tabNames[targetId] || targetId}`);
};

const subTabButtons = document.querySelectorAll('.sub-tab-btn');
subTabButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = btn.getAttribute('data-subtab');
    if (targetId && window.switchSubTab) {
      window.switchSubTab(targetId);
    }
  });
});

// Controls: 2 Nút Chiếu Màn Hình Tách Bạch & Panda
const elBtnStartMirror = document.getElementById('btnStartMirror');
const elBtnMirrorTitle = document.getElementById('btnMirrorTitle');
const elBtnMirrorSub = document.getElementById('btnMirrorSub');
const elBtnStopMirror = document.getElementById('btnStopMirror');
const elBtnActivatePanda = document.getElementById('btnActivatePanda');

// Add Custom Game Elements
const elBtnToggleAddGame = document.getElementById('btnToggleAddGame');
const elAddGameBox = document.getElementById('addGameBox');
const elBtnCloseAddGame = document.getElementById('btnCloseAddGame');
const elTxtNewGameName = document.getElementById('txtNewGameName');
const elTxtNewGameIcon = document.getElementById('txtNewGameIcon');
const elSelNewGameCat = document.getElementById('selNewGameCat');
const elBtnConfirmAddGame = document.getElementById('btnConfirmAddGame');

// Profile & Mode Elements
const elGameSelectorGrid = document.getElementById('gameSelectorGrid');
const elLblProfileCategory = document.getElementById('lblProfileCategory');
const elBtnPrevMode = document.getElementById('btnPrevMode');
const elBtnNextMode = document.getElementById('btnNextMode');
const elLblModeIcon = document.getElementById('lblModeIcon');
const elLblModeName = document.getElementById('lblModeName');
const elLblModeTag = document.getElementById('lblModeTag');
const elLblModeDesc = document.getElementById('lblModeDesc');
const elBadgeFps = document.getElementById('badgeFps');
const elBadgeCodec = document.getElementById('badgeCodec');
const elBadgeBuffer = document.getElementById('badgeBuffer');
const elBadgeBitrate = document.getElementById('badgeBitrate');
const elBadgeSize = document.getElementById('badgeSize');

// Tuning Selects
const elSelCodec = document.getElementById('selCodec');
const elSelFps = document.getElementById('selFps');
const elSelDisplayBuffer = document.getElementById('selDisplayBuffer');
const elSelMaxSize = document.getElementById('selMaxSize');
const elSelBitrate = document.getElementById('selBitrate');
const elSelRenderDriver = document.getElementById('selRenderDriver');
const elSelMouseSpeed = document.getElementById('selMouseSpeed');
const elRadModeBlackTab = document.getElementById('radModeBlackTab');
const elRadModeMirror = document.getElementById('radModeMirror');
const elLblModeBlackTab = document.getElementById('lblModeBlackTab');
const elLblModeMirror = document.getElementById('lblModeMirror');
const elChkEnableControl = document.getElementById('chkEnableControl');
const elChkUhidInput = document.getElementById('chkUhidInput');
const elChkTurnScreenOff = document.getElementById('chkTurnScreenOff');
const elChkForwardAudio = document.getElementById('chkForwardAudio');
const elChkStayAwake = document.getElementById('chkStayAwake');

// GitHub Sync Elements
const elTxtGithubToken = document.getElementById('txtGithubToken');
const elBtnToggleTokenVisibility = document.getElementById('btnToggleTokenVisibility');
const elTxtGithubGistId = document.getElementById('txtGithubGistId');
const elBtnSyncUpload = document.getElementById('btnSyncUpload');
const elBtnSyncDownload = document.getElementById('btnSyncDownload');
const elBtnExportJson = document.getElementById('btnExportJson');
const elBtnSaveJsonFile = document.getElementById('btnSaveJsonFile');
const elTxtImportJson = document.getElementById('txtImportJson');
const elBtnImportJson = document.getElementById('btnImportJson');
const elProfileListOverview = document.getElementById('profileListOverview');

// Window Controls & Drawer Elements
const elBtnMinWindow = document.getElementById('btnMinWindow');
const elBtnCloseWindow = document.getElementById('btnCloseWindow');
const elBtnPinWindow = document.getElementById('btnPinWindow');
const elBtnToggleExpand = document.getElementById('btnToggleExpand');
const elBtnOpenDrawer = document.getElementById('btnOpenDrawer');
const elBtnCloseDrawer = document.getElementById('btnCloseDrawer');
const settingsDrawer = document.getElementById('settingsDrawer');
const elHeroPlayIcon = document.getElementById('heroPlayIcon');
const elBtnToggleKeymapHud = document.getElementById('btnToggleKeymapHud');
const elBtnToggleCooler = document.getElementById('btnToggleCooler');
const elCoolerStatusBadge = document.getElementById('coolerStatusBadge');

// Utilities Elements
const elTxtSendText = document.getElementById('txtSendText');
const elBtnSendText = document.getElementById('btnSendText');
const elBtnScreenshot = document.getElementById('btnScreenshot');
const elTxtUrl = document.getElementById('txtUrl');
const elBtnOpenUrl = document.getElementById('btnOpenUrl');
const elBtnRestartAdb = document.getElementById('btnRestartAdb');
const elBtnRefresh = document.getElementById('btnRefresh');

// Switch Key, Full View & Auto-Reconnect Elements
const elSelSwitchKey = document.getElementById('selSwitchKey');
const elBadgeActiveSwitchKey = document.getElementById('badgeActiveSwitchKey');
const elKbdSwitchKeyTop = document.getElementById('kbdSwitchKeyTop');
const elChipSwitchKey = document.getElementById('chipSwitchKey');
const elChkFullView = document.getElementById('chkFullView');
const elSelFullViewMode = document.getElementById('selFullViewMode');
const elRowFullViewMode = document.getElementById('rowFullViewMode');
const elChkAutoReconnect = document.getElementById('chkAutoReconnect');

function updateFooterLog(msg) {
  const time = new Date().toLocaleTimeString();
  const el = elFooterLog || document.getElementById('footerLog') || document.getElementById('elFooterLog');
  if (el) el.textContent = `[${time}] ${msg}`;
  console.log(`[${time}] ${msg}`);
}

// ================= IPC LISTENERS =================
window.api.onOtgLog((msg) => {
  updateFooterLog(msg.trim());
});

window.api.onOtgStatus((status) => {
  if (status.reconnecting) {
    updateFooterLog(`🔄 [Chống văng] Màn hình bị gián đoạn, đang tự động kết nối lại trong 1.5 giây...`);
    return;
  }
  if (!status.running) {
    setControllingState(false);
    if (status.code !== 0 && status.code !== null && status.code !== undefined) {
      updateFooterLog(`⚠️ Phiên điều khiển đã dừng (Mã: ${status.code})${status.error ? ': ' + status.error : ''}`);
      if (status.error && status.error.includes('unauthorized')) {
        alert('⚠️ Điện thoại chưa được cấp quyền!\n\nVui lòng mở khóa điện thoại và chọn "Cho phép gỡ lỗi USB" (Allow USB debugging).');
      } else if (status.error && (status.error.includes('offline') || status.error.includes('closed'))) {
        updateFooterLog('⚠️ Thiết bị bị ngắt kết nối. Vui lòng kiểm tra lại dây cáp USB!');
      }
    } else {
      updateFooterLog(`Đã dừng điều khiển.`);
    }
  }
});

window.api.onRequestStartControl(() => {
  updateFooterLog('Đang khởi động điều khiển...');
  handleToggleControl();
});

// Lắng nghe khi bấm phím nóng Alt+Left / Alt+Right đổi chế độ
window.api.onModeChanged((result) => {
  if (result && result.mode) {
    activeProfile = result.profile;
    activeMode = result.mode;
    playSoundCue('mode');
    updateModeDisplay();
    updateFooterLog(`🎮 Đã chuyển sang [${result.profile.name} - ${result.mode.name}]!`);
    
    // Đồng bộ tốc độ chuột tức thì mà KHÔNG restart làm văng màn hình game
    if (result.mode.mouseSpeed && window.api && window.api.setMouseSpeed) {
      window.api.setMouseSpeed(result.mode.mouseSpeed);
    }
  }
});

// ================= TRẠNG THÁI ĐIỀU KHIỂN (2 NÚT BẮT ĐẦU VÀ DỪNG LẠI) =================
function setControllingState(active) {
  isControlling = active;
  if (elBtnStopMirror) {
    elBtnStopMirror.disabled = !active;
    if (active) {
      elBtnStopMirror.classList.add('active-stop');
    } else {
      elBtnStopMirror.classList.remove('active-stop');
    }
  }

  const isMirror = elRadModeMirror && elRadModeMirror.checked;

  if (active) {
    if (elStatusDot) elStatusDot.className = 'dot connected';
    if (elBtnStartMirror) elBtnStartMirror.classList.add('running');
    if (elBtnMirrorTitle) elBtnMirrorTitle.textContent = 'DỪNG LẠI';
    if (elBtnMirrorSub) elBtnMirrorSub.textContent = 'Alt: Nhả chuột';
    if (elHeroPlayIcon) elHeroPlayIcon.textContent = '⏹';
    updateFooterLog('🎮 ĐANG ĐIỀU KHIỂN & CHIẾU MÀN HÌNH! Nhấn Alt để nhả chuột về máy tính.');
  } else {
    if (elBtnStartMirror) elBtnStartMirror.classList.remove('running');
    if (elBtnMirrorTitle) elBtnMirrorTitle.textContent = 'BẮT ĐẦU';
    if (elBtnMirrorSub) elBtnMirrorSub.textContent = `${(activeMode && activeMode.fps) ? activeMode.fps : 120} FPS • 0ms`;
    if (elHeroPlayIcon) elHeroPlayIcon.textContent = '▶';
    updateModeCardVisuals();
    updateDeviceList();
  }
}

function updateQuickWifiEntryBarUI(isWifi = false, noDevice = false) {
  const bar = document.getElementById('quickWifiEntryBar');
  const icon = document.getElementById('qWifiIcon');
  const text = document.getElementById('qWifiText');
  const badge = document.getElementById('qWifiBadge');
  if (!bar) return;
  bar.style.display = 'flex';

  if (noDevice) {
    bar.classList.remove('wifi-active');
    if (icon) icon.textContent = '📶';
    if (text) text.textContent = 'Nhập Địa Chỉ IP Wi-Fi';
    if (badge) badge.textContent = 'Mở Ô Nhập';
    bar.title = 'Mở ô nhập địa chỉ IP Wi-Fi để kết nối không dây';
    if (window.api && window.api.findHotspotDevices) {
      window.api.findHotspotDevices().then(hs => {
        if (hs && hs.autoDetectedIp && !currentDeviceId) {
          if (icon) icon.textContent = '🔥';
          if (text) text.textContent = `Nối Hotspot: ${hs.autoDetectedIp}`;
          if (badge) badge.textContent = 'Nối Ngay';
        }
      }).catch(() => {});
    }
  } else if (isWifi) {
    bar.classList.add('wifi-active');
    if (icon) icon.textContent = '📶';
    const cleanIp = (currentDeviceId || '').replace(':5555', '');
    if (text) text.textContent = `Đang Dùng Wi-Fi: ${cleanIp}`;
    if (badge) badge.textContent = 'Rút Cáp OK';
    bar.title = 'Điện thoại đang kết nối Wi-Fi hoàn toàn. Bạn có thể rút cáp USB ra và chơi bình thường!';
  } else {
    // Đang cắm cáp USB
    bar.classList.remove('wifi-active');
    if (icon) icon.textContent = '⚡';
    if (text) text.textContent = '1-Click Chuyển Wi-Fi (Rút Cáp)';
    if (badge) badge.textContent = 'Tự Động';
    bar.title = 'Cắm cáp USB + chung Wi-Fi/Hotspot: Bấm vào đây để tự động mở cổng 5555 và chuyển sang Wi-Fi để rút cáp!';
  }
}

function updateConnectionModeVisuals() {
  const isUsb = preferredConnectionMode === 'usb';
  const isWifi = preferredConnectionMode === 'wifi';
  const isAuto = preferredConnectionMode === 'auto';
  const btnUsb = document.getElementById('btnLockConnUsb');
  const btnWifi = document.getElementById('btnLockConnWifi');
  const btnAuto = document.getElementById('btnLockConnAuto');
  if (btnUsb) btnUsb.classList.toggle('active', isUsb);
  if (btnWifi) btnWifi.classList.toggle('active', isWifi);
  if (btnAuto) btnAuto.classList.toggle('active', isAuto);
}

const elBtnLockConnUsb = document.getElementById('btnLockConnUsb');
const elBtnLockConnWifi = document.getElementById('btnLockConnWifi');
const elBtnLockConnAuto = document.getElementById('btnLockConnAuto');

if (elBtnLockConnUsb) {
  elBtnLockConnUsb.addEventListener('click', async () => {
    preferredConnectionMode = 'usb';
    localStorage.setItem('pandakey_pref_conn_mode', 'usb');
    updateConnectionModeVisuals();
    playSoundCue('mode');
    updateFooterLog('🔒 Đang khóa cứng kết nối Cáp USB (dọn dẹp kết nối Wi-Fi)...');

    if (window.api && window.api.setConnectionLockMode) {
      await window.api.setConnectionLockMode('usb');
    }
    // Ngắt toàn bộ kết nối Wi-Fi để dứt điểm hiện tượng nhảy loạn qua lại
    if (window.api && window.api.disconnectAllWifi) {
      await window.api.disconnectAllWifi();
    }

    await updateDeviceList();

    if (currentDeviceId && !currentDeviceId.includes(':')) {
      lockedDeviceId = currentDeviceId;
      localStorage.setItem('pandakey_locked_device_id', currentDeviceId);
      if (window.api && window.api.setSelectedDevice) {
        await window.api.setSelectedDevice(currentDeviceId, { connectionMode: 'usb' });
      }
      updateFooterLog(`🔒 [ĐÃ KHÓA CỨNG USB] ${currentDeviceId} (0ms lag, tuyệt đối không nhảy Wi-Fi)`);
      if (isControlling) {
        startCurrentControl();
      }
    } else {
      updateFooterLog('⚠️ Đang khóa Cáp USB: Vui lòng cắm cáp USB và bật Gỡ lỗi USB trên điện thoại.');
    }
  });
}

if (elBtnLockConnWifi) {
  elBtnLockConnWifi.addEventListener('click', async () => {
    preferredConnectionMode = 'wifi';
    localStorage.setItem('pandakey_pref_conn_mode', 'wifi');
    updateConnectionModeVisuals();
    playSoundCue('mode');

    if (window.api && window.api.setConnectionLockMode) {
      await window.api.setConnectionLockMode('wifi');
    }

    await updateDeviceList();

    const isWifi = currentDeviceId && currentDeviceId.includes(':');
    if (isWifi) {
      lockedDeviceId = currentDeviceId;
      localStorage.setItem('pandakey_locked_device_id', currentDeviceId);
      if (window.api && window.api.setSelectedDevice) {
        await window.api.setSelectedDevice(currentDeviceId, { connectionMode: 'wifi' });
      }
      updateFooterLog(`🔒 [ĐÃ KHÓA CỨNG WI-FI] ${currentDeviceId} (Không dây, không nhảy USB kể cả khi cắm sạc)`);
      if (isControlling) {
        startCurrentControl();
      }
    } else {
      updateFooterLog('📶 Đang khóa Wi-Fi: Chưa có thiết bị Wi-Fi nào kết nối. Đang mở hộp thoại...');
      openWifiModal();
    }
  });
}

if (elBtnLockConnAuto) {
  elBtnLockConnAuto.addEventListener('click', async () => {
    preferredConnectionMode = 'auto';
    localStorage.setItem('pandakey_pref_conn_mode', 'auto');
    updateConnectionModeVisuals();
    playSoundCue('mode');

    if (window.api && window.api.setConnectionLockMode) {
      await window.api.setConnectionLockMode('auto');
    }

    await updateDeviceList();

    if (currentDeviceId) {
      lockedDeviceId = currentDeviceId;
      localStorage.setItem('pandakey_locked_device_id', currentDeviceId);
      if (window.api && window.api.setSelectedDevice) {
        await window.api.setSelectedDevice(currentDeviceId, { connectionMode: 'auto' });
      }
      updateFooterLog(`⚡ [TỰ ĐỘNG LINH HOẠT] Đã chọn ${currentDeviceId} (Ưu tiên USB, rút cáp tự sang Wi-Fi)`);
      if (isControlling) {
        startCurrentControl();
      }
    } else {
      updateFooterLog('⚡ [Tự Động] Vui lòng cắm cáp USB hoặc kết nối Wi-Fi với điện thoại.');
    }
  });
}

async function updateDeviceList() {
  try {
    const res = await window.api.getDevices();
    let devices = (res && res.success && Array.isArray(res.devices)) ? res.devices : [];

    // Lọc bỏ triệt để các thiết bị offline
    devices = devices.filter(d => d.state !== 'offline');

    let matchedDev = null;

    if (preferredConnectionMode === 'usb') {
      // 1. KHÓA CỨNG CÁP USB: CHỈ chọn thiết bị Cáp USB (!d.isWifi)
      const usbDevices = devices.filter(d => !d.isWifi);
      if (usbDevices.length > 0) {
        if (lockedDeviceId && !lockedDeviceId.includes(':')) {
          matchedDev = usbDevices.find(d => d.id === lockedDeviceId);
        }
        if (!matchedDev) {
          matchedDev = usbDevices[0];
        }
        currentDeviceId = matchedDev.id;
        lockedDeviceId = currentDeviceId;
        localStorage.setItem('pandakey_locked_device_id', currentDeviceId);
      } else {
        // KHÔNG có USB nào: Tuyệt đối KHÔNG gán Wi-Fi device!
        currentDeviceId = null;
      }
    } else if (preferredConnectionMode === 'wifi') {
      // 2. KHÓA CỨNG WI-FI: CHỈ chọn thiết bị Wi-Fi (d.isWifi)
      const wifiDevices = devices.filter(d => d.isWifi);
      if (wifiDevices.length > 0) {
        if (lockedDeviceId && lockedDeviceId.includes(':')) {
          matchedDev = wifiDevices.find(d => d.id === lockedDeviceId);
        }
        if (!matchedDev) {
          matchedDev = wifiDevices[0];
        }
        currentDeviceId = matchedDev.id;
        lockedDeviceId = currentDeviceId;
        localStorage.setItem('pandakey_locked_device_id', currentDeviceId);
      } else {
        // KHÔNG có Wi-Fi nào: Tuyệt đối KHÔNG gán USB device (kể cả khi cắm cáp sạc)!
        currentDeviceId = null;
      }
    } else {
      // 3. TỰ ĐỘNG LINH HOẠT: Ưu tiên USB, nếu không có thì lấy Wi-Fi
      const usbDevices = devices.filter(d => !d.isWifi);
      const wifiDevices = devices.filter(d => d.isWifi);
      if (usbDevices.length > 0) {
        if (lockedDeviceId && !lockedDeviceId.includes(':')) {
          matchedDev = usbDevices.find(d => d.id === lockedDeviceId);
        }
        if (!matchedDev) matchedDev = usbDevices[0];
      } else if (wifiDevices.length > 0) {
        if (lockedDeviceId && lockedDeviceId.includes(':')) {
          matchedDev = wifiDevices.find(d => d.id === lockedDeviceId);
        }
        if (!matchedDev) matchedDev = wifiDevices[0];
      }
      if (matchedDev) {
        currentDeviceId = matchedDev.id;
        lockedDeviceId = currentDeviceId;
        localStorage.setItem('pandakey_locked_device_id', currentDeviceId);
      } else {
        currentDeviceId = null;
      }
    }

    // Cập nhật dropdown thiết bị
    if (elSelDeviceList) {
      if (devices.length === 0) {
        elSelDeviceList.innerHTML = '<option value="">Chưa có thiết bị nào</option>';
      } else {
        let waitingPrompt = '';
        if (preferredConnectionMode === 'usb') waitingPrompt = '🔒 [Khóa USB] Đang chờ cắm cáp USB...';
        else if (preferredConnectionMode === 'wifi') waitingPrompt = '🔒 [Khóa Wi-Fi] Đang chờ kết nối Wi-Fi...';
        else waitingPrompt = '⚡ [Tự Động] Đang chờ thiết bị...';

        let optionsHtml = '';
        if (!currentDeviceId) {
          optionsHtml += `<option value="" selected>${waitingPrompt}</option>`;
        }

        optionsHtml += devices.map(dev => {
          let typeDesc = dev.isWifi ? 'Wi-Fi' : 'Cáp USB';
          if (preferredConnectionMode === 'usb' && dev.isWifi) {
            typeDesc = 'Wi-Fi - Bị Khóa USB';
          } else if (preferredConnectionMode === 'wifi' && !dev.isWifi) {
            typeDesc = 'Cáp USB - Bị Khóa Wi-Fi';
          }
          const statusSuffix = dev.state === 'unauthorized' ? ' [⚠️ Chưa cấp quyền]' : '';
          const isSelected = (currentDeviceId && dev.id === currentDeviceId) ? 'selected' : '';
          return `<option value="${dev.id}" ${isSelected}>${dev.model || 'Điện thoại'} (${typeDesc})${statusSuffix}</option>`;
        }).join('');

        elSelDeviceList.innerHTML = optionsHtml;
        if (currentDeviceId) {
          elSelDeviceList.value = currentDeviceId;
        }
      }
    }

    if (currentDeviceId) {
      if (window.api && window.api.setSelectedDevice) {
        window.api.setSelectedDevice(currentDeviceId, { connectionMode: preferredConnectionMode });
      }

      const activeDev = devices.find(d => d.id === currentDeviceId) || { id: currentDeviceId, isWifi: currentDeviceId.includes(':') };
      const isWifiDev = activeDev.isWifi;
      const modeTag = preferredConnectionMode === 'usb' ? '🔒 Đã Khóa USB' : preferredConnectionMode === 'wifi' ? '🔒 Đã Khóa Wi-Fi' : '⚡ Tự Động';

      if (activeDev.state === 'unauthorized') {
        elDeviceText.textContent = `${activeDev.model || 'Điện thoại'} (⚠️ Cần bấm "Cho phép" trên màn hình)`;
        elStatusDot.className = 'dot';
      } else {
        elDeviceText.textContent = `${activeDev.model || 'Điện thoại'} (${isWifiDev ? 'Wi-Fi' : 'Cáp USB'}) - ${modeTag}`;
        elStatusDot.className = 'dot connected';
      }

      // Cập nhật trạng thái Wi-Fi Hub
      const elLblWifiBadge = document.getElementById('lblWifiBadge');
      if (elLblWifiBadge) {
        if (isWifiDev) {
          elLblWifiBadge.textContent = 'Đã kết nối';
          elLblWifiBadge.style.color = '#00ff88';
        } else {
          elLblWifiBadge.textContent = 'Cáp USB';
          elLblWifiBadge.style.color = '';
        }
      }
      if (isWifiDev) {
        checkWifiDiagnostics(currentDeviceId);
      } else {
        const diag = document.getElementById('wifiDiagnosticsBar');
        if (diag) diag.style.display = 'none';
      }
      updateQuickWifiEntryBarUI(isWifiDev, false);
    } else {
      // Khi không có thiết bị phù hợp với chế độ khóa
      elStatusDot.className = 'dot';
      if (preferredConnectionMode === 'usb') {
        elDeviceText.textContent = '🔒 Đang khóa Cáp USB: Vui lòng cắm cáp USB vào máy tính';
      } else if (preferredConnectionMode === 'wifi') {
        elDeviceText.textContent = '🔒 Đang khóa Wi-Fi: Chưa kết nối điện thoại qua Wi-Fi';
      } else {
        elDeviceText.textContent = 'Chưa cắm điện thoại qua USB hoặc kết nối Wi-Fi';
      }
      const elLblWifiBadge = document.getElementById('lblWifiBadge');
      if (elLblWifiBadge) {
        elLblWifiBadge.textContent = 'Chưa nối';
        elLblWifiBadge.style.color = '';
      }
      const diag = document.getElementById('wifiDiagnosticsBar');
      if (diag) diag.style.display = 'none';
      updateQuickWifiEntryBarUI(false, true);
    }

    updateConnectionModeVisuals();
  } catch (err) {
    updateFooterLog(`Lỗi kiểm tra thiết bị: ${err.message}`);
  }
}

if (elSelDeviceList) {
  elSelDeviceList.addEventListener('change', async () => {
    const chosenId = elSelDeviceList.value;
    if (!chosenId) return;

    currentDeviceId = chosenId;
    const isWifi = currentDeviceId.includes(':');

    // Nếu người dùng chủ động chọn thiết bị khác kiểu kết nối hiện tại -> Cập nhật chế độ tương ứng
    if (isWifi && preferredConnectionMode === 'usb') {
      preferredConnectionMode = 'wifi';
      localStorage.setItem('pandakey_pref_conn_mode', 'wifi');
      if (window.api && window.api.setConnectionLockMode) {
        await window.api.setConnectionLockMode('wifi');
      }
    } else if (!isWifi && preferredConnectionMode === 'wifi') {
      preferredConnectionMode = 'usb';
      localStorage.setItem('pandakey_pref_conn_mode', 'usb');
      if (window.api && window.api.setConnectionLockMode) {
        await window.api.setConnectionLockMode('usb');
      }
    }

    lockedDeviceId = currentDeviceId;
    localStorage.setItem('pandakey_locked_device_id', currentDeviceId);
    updateConnectionModeVisuals();

    const modeName = preferredConnectionMode === 'usb' ? 'Khóa Cáp USB' : preferredConnectionMode === 'wifi' ? 'Khóa Wi-Fi' : 'Tự Động';
    updateFooterLog(`🔒 [Đã Cố Định] Thiết bị: ${currentDeviceId} (${modeName})`);

    if (window.api && window.api.setSelectedDevice) {
      await window.api.setSelectedDevice(currentDeviceId, { connectionMode: preferredConnectionMode });
    }
    if (window.api && window.api.pollHardwareStats) {
      window.api.pollHardwareStats();
    }
    const elLblWifiBadge = document.getElementById('lblWifiBadge');
    if (elLblWifiBadge) {
      elLblWifiBadge.textContent = isWifi ? 'Đã kết nối' : (currentDeviceId ? 'USB' : 'Chưa nối');
      if (isWifi) elLblWifiBadge.style.color = '#00ff88';
      else elLblWifiBadge.style.color = '';
    }
    if (isWifi) {
      checkWifiDiagnostics(currentDeviceId);
    } else {
      const diag = document.getElementById('wifiDiagnosticsBar');
      if (diag) diag.style.display = 'none';
    }
    updateQuickWifiEntryBarUI(isWifi, !currentDeviceId);
    refreshBatteryStats();

    if (isControlling) {
      updateFooterLog(`⚡ Đang áp dụng thiết bị mới vào phiên điều khiển: ${currentDeviceId}...`);
      startCurrentControl();
    }
  });
}

// Bắt đầu điều khiển với các cờ tối ưu hình ảnh & độ trễ
async function startCurrentControl() {
  try {
    if (elSelDeviceList && elSelDeviceList.value) {
      currentDeviceId = elSelDeviceList.value;
    }
    if (!currentDeviceId) {
      await updateDeviceList();
    }

    if (preferredConnectionMode === 'usb') {
      if (!currentDeviceId || currentDeviceId.includes(':')) {
        alert('⚠️ Đang ở chế độ KHÓA CỨNG CÁP USB!\n\nVui lòng cắm cáp USB vào máy tính và bật "Gỡ lỗi USB" trên điện thoại để bắt đầu điều khiển (hoặc bấm nút "Khóa Wi-Fi" / "Tự Động" nếu muốn dùng không dây).');
        updateFooterLog('⚠️ Đang khóa Cáp USB: Vui lòng cắm cáp USB vào máy tính!');
        return;
      }
    } else if (preferredConnectionMode === 'wifi') {
      if (!currentDeviceId || !currentDeviceId.includes(':')) {
        alert('⚠️ Đang ở chế độ KHÓA CỨNG WI-FI!\n\nChưa có kết nối Wi-Fi nào. Vui lòng kết nối Wi-Fi để bắt đầu điều khiển (hoặc bấm nút "Khóa Cáp USB" nếu muốn dùng dây cáp).');
        updateFooterLog('⚠️ Đang khóa Wi-Fi: Chưa có thiết bị Wi-Fi kết nối!');
        openWifiModal();
        return;
      }
    }

    if (!currentDeviceId) {
      alert('⚠️ Chưa phát hiện thấy điện thoại kết nối qua USB hoặc Wi-Fi!\n\nCác bước kiểm tra nhanh:\n1. Kết nối qua cáp USB hoặc Wi-Fi / Hotspot máy tính.\n2. Mở "Cài đặt" trên điện thoại -> "Tùy chọn nhà phát triển" -> Bật "Gỡ lỗi USB" (USB Debugging).\n3. Mở sáng màn hình điện thoại, nếu có thông báo "Cho phép gỡ lỗi USB?", hãy tích "Luôn cho phép từ máy tính này" và bấm "Cho phép".\n4. Bấm nút "Quét lại" trên phần mềm.');
      updateFooterLog('⚠️ Chưa tìm thấy thiết bị Android nào qua USB hoặc Wi-Fi!');
      return;
    }

    // Chế độ chiếu màn hình: Mặc định Tab Bảng Đen (Không chiếu màn hình PC)
    const isMirror = elRadModeMirror ? elRadModeMirror.checked : false;
    const isAudio = elChkForwardAudio ? elChkForwardAudio.checked : false;
    const options = {
      deviceId: currentDeviceId,
      connectionMode: preferredConnectionMode,
      codec: (elSelCodec && elSelCodec.value) || 'h264',
      fps: parseInt(elSelFps ? elSelFps.value : '60') || 60,
      displayBuffer: parseInt(elSelDisplayBuffer ? elSelDisplayBuffer.value : '10') || 10,
      videoBuffer: parseInt(elSelDisplayBuffer ? elSelDisplayBuffer.value : '10') || 10,
      maxSize: parseInt(elSelMaxSize ? elSelMaxSize.value : '1080') || 1080,
      bitrate: (elSelBitrate && elSelBitrate.value) || '16M',
      renderDriver: (elSelRenderDriver && elSelRenderDriver.value) || 'direct3d11',
      mouseSpeed: elSelMouseSpeed ? elSelMouseSpeed.value : 'native',
      mirrorScreen: isMirror,
      enableControl: elChkEnableControl ? elChkEnableControl.checked : true,
      uhidInput: elChkUhidInput ? elChkUhidInput.checked : true,
      turnScreenOff: elChkTurnScreenOff ? elChkTurnScreenOff.checked : false,
      forwardAudio: isAudio,
      stayAwake: elChkStayAwake ? elChkStayAwake.checked : true,
      fullView: elChkFullView ? elChkFullView.checked : true,
      fullViewMode: elSelFullViewMode ? elSelFullViewMode.value : 'fullscreen',
      autoReconnect: elChkAutoReconnect ? elChkAutoReconnect.checked : true,
      recordGameplay: !!(document.getElementById('chkAutoRecord') && document.getElementById('chkAutoRecord').checked)
    };

    const modeDetailText = isMirror && options.fullView ? ` | Full View (${options.fullViewMode === 'borderless' ? 'Tràn viền' : 'Toàn màn hình'})` : '';
    updateFooterLog(`Đang kích hoạt [${activeProfile ? activeProfile.name : 'Game'}]: ${options.codec.toUpperCase()} | ${options.fps} FPS${modeDetailText}...`);
    playSoundCue('activate');

    const res = await window.api.startControl(options);

    if (res && res.success) {
      setControllingState(true);
      updateFooterLog(res.message);
    } else {
      setControllingState(false);
      updateFooterLog(`Lỗi khởi chạy: ${res?.message || 'Không rõ nguyên nhân'}`);
      alert(`Không thể khởi động điều khiển: ${res?.message || 'Lỗi không xác định'}\n\nHãy đảm bảo đã bật "Gỡ lỗi USB" trên điện thoại.`);
    }
  } catch (err) {
    console.error('Lỗi startCurrentControl:', err);
    updateFooterLog(`Lỗi startCurrentControl: ${err.message}`);
    alert(`Lỗi thực thi: ${err.message}`);
  }
}

async function handleToggleControl() {
  if (isControlling) {
    const res = await window.api.stopControl();
    if (res.success) {
      setControllingState(false);
      updateFooterLog('Đã dừng điều khiển.');
    }
  } else {
    await startCurrentControl();
  }
}

// 2 Nút Bắt Đầu Chiếu và Dừng Lại Tách Bạch
if (elBtnStartMirror) {
  elBtnStartMirror.addEventListener('click', async () => {
    if (isControlling) {
      await window.api.stopControl();
      setControllingState(false);
      updateFooterLog('Đã dừng chiếu màn hình và nhả chuột về máy tính.');
    } else {
      await startCurrentControl();
    }
  });
}

if (elBtnStopMirror) {
  elBtnStopMirror.addEventListener('click', async () => {
    await window.api.stopControl();
    setControllingState(false);
    updateFooterLog('Đã dừng chiếu màn hình và nhả chuột về máy tính.');
  });
}

// Thay đổi tức thì độ nhạy chuột ĐT (Không cần khởi động lại)
if (elSelMouseSpeed) {
  elSelMouseSpeed.addEventListener('change', async () => {
    const val = elSelMouseSpeed.value;
    if (window.api && window.api.setMouseSpeed) {
      await window.api.setMouseSpeed(val);
    }
    const label = elSelMouseSpeed.options[elSelMouseSpeed.selectedIndex] ? elSelMouseSpeed.options[elSelMouseSpeed.selectedIndex].text : val;
    updateFooterLog(`⚡ Đã cập nhật độ nhạy chuột ĐT: ${label}`);
  });
}

// ================= CÀI ĐẶT & ĐỒNG BỘ PHÍM CHUYỂN CHUỘT (PC ⇋ ĐIỆN THOẠI) =================
function formatSwitchKeyLabel(key) {
  const k = (key || 'alt').toLowerCase();
  switch (k) {
    case 'alt': return 'ALT';
    case 'tilde': return '~ (TILDE)';
    case 'capslock': return 'CAPS LOCK';
    case 'ctrl': return 'CTRL';
    case 'tab': return 'TAB';
                    case 'mbutton': return 'CHUỘT GIỮA';
    case 'xbutton1': return 'CHUỘT HÔNG 4';
    case 'xbutton2': return 'CHUỘT HÔNG 5';
    default: return k.toUpperCase();
  }
}

function updateSwitchKeyDisplay(key) {
  const label = formatSwitchKeyLabel(key);
  if (elBadgeActiveSwitchKey) {
    elBadgeActiveSwitchKey.textContent = `Nút: ${label}`;
  }
  if (elKbdSwitchKeyTop) {
    elKbdSwitchKeyTop.textContent = label;
  }
  updateModeCardVisuals();
}

async function initSwitchKey() {
  let currentKey = 'alt';
  try {
    if (window.api && window.api.getSwitchKey) {
      currentKey = await window.api.getSwitchKey();
    } else {
      currentKey = localStorage.getItem('pandakey_switch_key') || 'alt';
    }
  } catch (e) {
    currentKey = localStorage.getItem('pandakey_switch_key') || 'alt';
  }

  if (elSelSwitchKey) {
    elSelSwitchKey.value = currentKey;
  }
  updateSwitchKeyDisplay(currentKey);
}

if (elSelSwitchKey) {
  elSelSwitchKey.addEventListener('change', async () => {
    const key = elSelSwitchKey.value;
    try {
      localStorage.setItem('pandakey_switch_key', key);
      if (window.api && window.api.setSwitchKey) {
        await window.api.setSwitchKey(key);
      }
      updateSwitchKeyDisplay(key);
      updateFooterLog(`⚡ Đã đổi nút chuyển chuột sang: [${formatSwitchKeyLabel(key)}] (Có hiệu lực ngay 0ms)`);
      playSoundCue('activate');
    } catch (e) {
      console.error(e);
    }
  });
}

if (elChipSwitchKey) {
  elChipSwitchKey.addEventListener('click', () => {
    if (settingsDrawer) settingsDrawer.classList.add('open');
    if (elSelSwitchKey) {
      elSelSwitchKey.focus();
    }
  });
}

const chipActiveModeMini = document.getElementById('chipActiveModeMini');
if (chipActiveModeMini) {
  chipActiveModeMini.addEventListener('click', () => {
    if (elBtnNextMode) elBtnNextMode.click();
  });
}

if (elChkFullView && elRowFullViewMode) {
  elChkFullView.addEventListener('change', () => {
    elRowFullViewMode.style.display = elChkFullView.checked ? 'flex' : 'none';
  });
}

// Đồng bộ giao diện khi chuyển đổi giữa Tab Bảng Đen và Chiếu Màn Hình PC
function updateModeCardVisuals() {
  const isMirror = elRadModeMirror && elRadModeMirror.checked;
  if (elLblModeMirror) elLblModeMirror.classList.toggle('active', isMirror);
  if (elLblModeBlackTab) elLblModeBlackTab.classList.toggle('active', !isMirror);

  const elBtnToggleMirrorOn = document.getElementById('btnToggleMirrorOn');
  const elBtnToggleMirrorOff = document.getElementById('btnToggleMirrorOff');
  if (elBtnToggleMirrorOn) elBtnToggleMirrorOn.classList.toggle('active', isMirror);
  if (elBtnToggleMirrorOff) elBtnToggleMirrorOff.classList.toggle('active', !isMirror);

  const activeKeyName = elSelSwitchKey ? formatSwitchKeyLabel(elSelSwitchKey.value) : 'ALT';

  if (!isControlling) {
    if (isMirror) {
      if (elBtnMirrorTitle) elBtnMirrorTitle.textContent = 'BẮT ĐẦU CHIẾU MÀN HÌNH';
      if (elBtnMirrorSub) elBtnMirrorSub.textContent = `Chiếu lên PC & Tương tác chuột phím (Phím tắt: Bấm ${activeKeyName} đổi chuột)`;
    } else {
      if (elBtnMirrorTitle) elBtnMirrorTitle.textContent = 'BẮT ĐẦU ĐIỀU KHIỂN (ẨN CỬA SỔ)';
      if (elBtnMirrorSub) elBtnMirrorSub.textContent = `Tàng hình 100% không vướng mắt • Bấm ${activeKeyName} đổi chuột tức thì 0ms`;
    }
  }
}

if (elRadModeBlackTab) {
  elRadModeBlackTab.addEventListener('change', updateModeCardVisuals);
}
if (elRadModeMirror) {
  elRadModeMirror.addEventListener('change', updateModeCardVisuals);
}

const elBtnToggleMirrorOn = document.getElementById('btnToggleMirrorOn');
const elBtnToggleMirrorOff = document.getElementById('btnToggleMirrorOff');

if (elBtnToggleMirrorOn) {
  elBtnToggleMirrorOn.addEventListener('click', () => {
    if (elRadModeMirror) elRadModeMirror.checked = true;
    if (elRadModeBlackTab) elRadModeBlackTab.checked = false;
    if (activeMode) activeMode.mirrorScreen = true;
    localStorage.setItem('pandakey_mirror_preference', 'true');
    playSoundCue('mode');
    updateModeCardVisuals();
    updateFooterLog('🖥️ Đã chọn: Chiếu toàn bộ màn hình điện thoại lên máy tính (120 FPS).');
    if (typeof saveCurrentProfileDraft === 'function') saveCurrentProfileDraft();
  });
}

if (elBtnToggleMirrorOff) {
  elBtnToggleMirrorOff.addEventListener('click', () => {
    if (elRadModeMirror) elRadModeMirror.checked = false;
    if (elRadModeBlackTab) elRadModeBlackTab.checked = true;
    if (activeMode) activeMode.mirrorScreen = false;
    localStorage.setItem('pandakey_mirror_preference', 'false');
    playSoundCue('mode');
    updateModeCardVisuals();
    updateFooterLog('📱 Đã chọn: Không chiếu lên máy tính (Nhìn thẳng màn điện thoại, 0% CPU, 0ms Lag).');
    if (typeof saveCurrentProfileDraft === 'function') saveCurrentProfileDraft();
  });
}

// ================= 🔊 BẬT / TẮT TRUYỀN ÂM THANH QUA MÁY TÍNH =================
const elBtnToggleAudioOn = document.getElementById('btnToggleAudioOn');
const elBtnToggleAudioOff = document.getElementById('btnToggleAudioOff');

function updateAudioVisuals(forwardAudio) {
  const isAudio = (forwardAudio !== undefined) ? !!forwardAudio : (elChkForwardAudio ? elChkForwardAudio.checked : false);
  if (elChkForwardAudio && elChkForwardAudio.checked !== isAudio) {
    elChkForwardAudio.checked = isAudio;
  }
  const btnOn = document.getElementById('btnToggleAudioOn');
  const btnOff = document.getElementById('btnToggleAudioOff');
  if (btnOn) btnOn.classList.toggle('active', isAudio);
  if (btnOff) btnOff.classList.toggle('active', !isAudio);
}

if (elBtnToggleAudioOn) {
  elBtnToggleAudioOn.addEventListener('click', async () => {
    if (elChkForwardAudio) elChkForwardAudio.checked = true;
    if (activeMode) activeMode.forwardAudio = true;
    localStorage.setItem('pandakey_audio_preference', 'true');
    updateAudioVisuals(true);
    playSoundCue('mode');
    updateFooterLog('🔊 Đã chọn: BẬT truyền âm thanh điện thoại sang máy tính.');
    if (window.api && window.api.toggleAudioForwarding) {
      await window.api.toggleAudioForwarding(true);
    } else if (isControlling) {
      startCurrentControl();
    }
    if (typeof saveCurrentProfileDraft === 'function') saveCurrentProfileDraft();
  });
}

if (elBtnToggleAudioOff) {
  elBtnToggleAudioOff.addEventListener('click', async () => {
    if (elChkForwardAudio) elChkForwardAudio.checked = false;
    if (activeMode) activeMode.forwardAudio = false;
    localStorage.setItem('pandakey_audio_preference', 'false');
    updateAudioVisuals(false);
    playSoundCue('mode');
    updateFooterLog('🔇 Đã chọn: TẮT truyền âm thanh - Nghe trực tiếp trên điện thoại.');
    if (window.api && window.api.toggleAudioForwarding) {
      await window.api.toggleAudioForwarding(false);
    } else if (isControlling) {
      startCurrentControl();
    }
    if (typeof saveCurrentProfileDraft === 'function') saveCurrentProfileDraft();
  });
}

if (window.api && window.api.onAudioForwardingChanged) {
  window.api.onAudioForwardingChanged(({ forwardAudio }) => {
    updateAudioVisuals(forwardAudio);
    if (activeMode) activeMode.forwardAudio = forwardAudio;
    updateFooterLog(forwardAudio ? '🔊 Đã BẬT truyền âm thanh sang máy tính' : '🔇 Đã TẮT truyền âm thanh sang máy tính');
  });
}

// ⭐ FORM THÊM GAME MỚI
if (elBtnToggleAddGame) {
  elBtnToggleAddGame.addEventListener('click', () => {
    const isHidden = elAddGameBox.style.display === 'none' || !elAddGameBox.style.display;
    elAddGameBox.style.display = isHidden ? 'flex' : 'none';
    if (isHidden && elTxtNewGameName) elTxtNewGameName.focus();
  });
}

if (elBtnCloseAddGame) {
  elBtnCloseAddGame.addEventListener('click', () => {
    elAddGameBox.style.display = 'none';
  });
}

if (elBtnConfirmAddGame) {
  elBtnConfirmAddGame.addEventListener('click', async () => {
    const name = elTxtNewGameName.value.trim();
    const icon = elTxtNewGameIcon.value.trim() || '🎮';
    const category = elSelNewGameCat.value;

    if (!name) {
      alert('Vui lòng nhập tên game mới.');
      elTxtNewGameName.focus();
      return;
    }

    const res = await window.api.addProfile({ name, icon, category });
    if (res.success && res.profile) {
      playSoundCue('activate');
      updateFooterLog(`Đã tạo thành công Profile Game: ${res.profile.name}!`);
      elTxtNewGameName.value = '';
      elTxtNewGameIcon.value = '';
      elAddGameBox.style.display = 'none';
      await loadProfiles();
      setActiveProfile(res.profile.id);
    }
  });
}

// ================= QUẢN LÝ PROFILES & GAME MODES =================
async function loadProfiles() {
  try {
    const data = await window.api.getProfiles();
    profilesData = data;
    renderGameSelector();

    // ⭐ Mặc định: Không chiếu màn hình PC (Tab Bảng Đen) & Tắt âm thanh PC
    if (localStorage.getItem('pandakey_mirror_preference') === null) {
      if (elRadModeMirror) elRadModeMirror.checked = false;
      if (elRadModeBlackTab) elRadModeBlackTab.checked = true;
    }
    if (localStorage.getItem('pandakey_audio_preference') === null) {
      if (elChkForwardAudio) elChkForwardAudio.checked = false;
    }

    setActiveProfile(data.activeProfileId || data.profiles[0].id);
    renderProfilesOverview();
  } catch (e) {
    console.error('Lỗi khi nạp profiles:', e);
  }
}

function renderGameSelector() {
  if (!profilesData || !profilesData.profiles) return;
  elGameSelectorGrid.innerHTML = '';

  profilesData.profiles.forEach(prof => {
    const card = document.createElement('div');
    card.className = `game-card ${prof.id === profilesData.activeProfileId ? 'active' : ''}`;
    card.setAttribute('data-id', prof.id);
    card.innerHTML = `
      <span class="game-card-icon">${prof.icon || '🎮'}</span>
      <span class="game-card-name">${prof.name}</span>
    `;
    card.addEventListener('click', () => {
      setActiveProfile(prof.id);
    });
    elGameSelectorGrid.appendChild(card);
  });
}

async function setActiveProfile(profileId) {
  if (!profilesData) return;
  const p = profilesData.profiles.find(x => x.id === profileId);
  if (!p) return;

  profilesData.activeProfileId = profileId;
  activeProfile = p;
  const modeIdx = p.activeModeIndex || 0;
  activeMode = (p.modes && p.modes[modeIdx]) ? p.modes[modeIdx] : p.modes[0];

  await window.api.setActiveProfile(profileId);

  // Cập nhật UI card
  document.querySelectorAll('.game-card').forEach(card => {
    if (card.getAttribute('data-id') === profileId) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  elLblProfileCategory.textContent = p.category || 'Game Tùy Chỉnh';
  updateModeDisplay();
}

function updateModeDisplay() {
  if (!activeMode) return;

  if (elLblModeIcon) elLblModeIcon.textContent = activeProfile.icon || '⚡';
  if (elLblModeName) elLblModeName.textContent = activeMode.name;
  if (elLblModeTag) elLblModeTag.textContent = activeMode.tag || 'Mặc Định';
  if (elLblModeDesc) elLblModeDesc.textContent = activeMode.description || '';

  const drawerTag = document.getElementById('drawerLblModeTag');
  const drawerDesc = document.getElementById('drawerLblModeDesc');
  if (drawerTag) drawerTag.textContent = activeMode.tag || 'Mặc Định';
  if (drawerDesc) drawerDesc.textContent = activeMode.description || '';

  // Badges
  if (elBadgeFps) elBadgeFps.textContent = `${activeMode.fps || 60} FPS`;
  if (elBadgeCodec) elBadgeCodec.textContent = (activeMode.codec || 'h264').toUpperCase();
  if (elBadgeBuffer) elBadgeBuffer.textContent = `Đệm: ${activeMode.displayBuffer !== undefined ? activeMode.displayBuffer : 0}ms`;
  if (elBadgeBitrate) elBadgeBitrate.textContent = activeMode.bitrate || '16M';
  if (elBadgeSize) elBadgeSize.textContent = activeMode.maxSize ? `${activeMode.maxSize}p` : 'Gốc';

  // Đồng bộ sang dropdown điều khiển
  if (elSelCodec && activeMode.codec) elSelCodec.value = activeMode.codec;
  if (elSelFps && activeMode.fps) elSelFps.value = String(activeMode.fps);
  if (elSelDisplayBuffer && activeMode.displayBuffer !== undefined) elSelDisplayBuffer.value = String(activeMode.displayBuffer);
  if (elSelMaxSize && activeMode.maxSize !== undefined) elSelMaxSize.value = String(activeMode.maxSize);
  if (elSelBitrate && activeMode.bitrate) elSelBitrate.value = activeMode.bitrate;
  if (elSelRenderDriver && activeMode.renderDriver) elSelRenderDriver.value = activeMode.renderDriver;
  if (elSelMouseSpeed && activeMode.mouseSpeed) elSelMouseSpeed.value = String(activeMode.mouseSpeed);

  // Cài đặt ưu tiên: Mặc định Tab Bảng Đen (Không chiếu màn hình) & Tắt âm thanh PC
  const savedMirrorPref = localStorage.getItem('pandakey_mirror_preference');
  if (savedMirrorPref !== null) {
    const isMirror = savedMirrorPref === 'true';
    if (elRadModeMirror) elRadModeMirror.checked = isMirror;
    if (elRadModeBlackTab) elRadModeBlackTab.checked = !isMirror;
  } else {
    // Mặc định: Không chiếu màn hình PC
    if (elRadModeMirror) elRadModeMirror.checked = false;
    if (elRadModeBlackTab) elRadModeBlackTab.checked = true;
    if (activeMode) activeMode.mirrorScreen = false;
  }
  if (typeof updateModeCardVisuals === 'function') updateModeCardVisuals();

  if (elChkEnableControl && activeMode.enableControl !== undefined) elChkEnableControl.checked = !!activeMode.enableControl;
  if (elChkUhidInput && activeMode.uhidInput !== undefined) elChkUhidInput.checked = activeMode.uhidInput !== false;
  if (elChkTurnScreenOff && activeMode.turnScreenOff !== undefined) elChkTurnScreenOff.checked = !!activeMode.turnScreenOff;

  const savedAudioPref = localStorage.getItem('pandakey_audio_preference');
  if (savedAudioPref !== null) {
    const isAudio = savedAudioPref === 'true';
    if (elChkForwardAudio) elChkForwardAudio.checked = isAudio;
    updateAudioVisuals(isAudio);
  } else {
    // Mặc định: Tắt âm thanh PC
    if (elChkForwardAudio) elChkForwardAudio.checked = false;
    if (activeMode) activeMode.forwardAudio = false;
    updateAudioVisuals(false);
  }
  if (activeMode.stayAwake !== undefined && elChkStayAwake) elChkStayAwake.checked = activeMode.stayAwake;
}

// Nút mũi tên Trái / Phải
if (elBtnNextMode) {
  elBtnNextMode.addEventListener('click', async () => {
    const result = await window.api.nextMode();
    if (result && result.mode) {
      activeProfile = result.profile;
      activeMode = result.mode;
      playSoundCue('mode');
      updateModeDisplay();
      updateFooterLog(`🎮 [Nút ▶] Đã chuyển sang: ${result.mode.name}`);
      if (isControlling) startCurrentControl();
    }
  });
}

if (elBtnPrevMode) {
  elBtnPrevMode.addEventListener('click', async () => {
    const result = await window.api.prevMode();
    if (result && result.mode) {
      activeProfile = result.profile;
      activeMode = result.mode;
      playSoundCue('mode');
      updateModeDisplay();
      updateFooterLog(`🎮 [Nút ◀] Đã chuyển sang: ${result.mode.name}`);
      if (isControlling) startCurrentControl();
    }
  });
}

const elDrawerBtnNextMode = document.getElementById('drawerBtnNextMode');
const elDrawerBtnPrevMode = document.getElementById('drawerBtnPrevMode');
if (elDrawerBtnNextMode) {
  elDrawerBtnNextMode.addEventListener('click', () => {
    if (elBtnNextMode) elBtnNextMode.click();
  });
}
if (elDrawerBtnPrevMode) {
  elDrawerBtnPrevMode.addEventListener('click', () => {
    if (elBtnPrevMode) elBtnPrevMode.click();
  });
}

// Lưu tùy chọn người dùng chỉnh thủ công vào active mode
function handleTuningChange() {
  if (!activeMode) return;
  const updatedOpts = {
    codec: elSelCodec.value,
    fps: parseInt(elSelFps.value) || 60,
    displayBuffer: parseInt(elSelDisplayBuffer.value) || 0,
    maxSize: parseInt(elSelMaxSize.value) || 0,
    bitrate: elSelBitrate.value,
    renderDriver: elSelRenderDriver.value,
    mouseSpeed: elSelMouseSpeed ? elSelMouseSpeed.value : '0.4',
    mirrorScreen: elRadModeMirror ? elRadModeMirror.checked : false,
    enableControl: elChkEnableControl ? elChkEnableControl.checked : true,
    uhidInput: elChkUhidInput ? elChkUhidInput.checked : true,
    turnScreenOff: elChkTurnScreenOff ? elChkTurnScreenOff.checked : false,
    forwardAudio: elChkForwardAudio.checked,
    stayAwake: elChkStayAwake.checked
  };

  Object.assign(activeMode, updatedOpts);
  updateModeDisplay();
  window.api.updateModeOptions(updatedOpts);
  updateFooterLog(`Đã cập nhật thông số cho chế độ: ${activeMode.name}`);
}

[elSelCodec, elSelFps, elSelDisplayBuffer, elSelMaxSize, elSelBitrate, elSelRenderDriver, elSelMouseSpeed, elRadModeMirror, elRadModeBlackTab, elChkEnableControl, elChkUhidInput, elChkTurnScreenOff, elChkForwardAudio, elChkStayAwake].filter(Boolean).forEach(input => {
  input.addEventListener('change', () => {
    handleTuningChange();
    if (isControlling) {
      updateFooterLog('⚡ Đang áp dụng thiết lập tối ưu mới vào phiên điều khiển...');
      startCurrentControl();
    }
  });
});

// ================= GITHUB CLOUD SYNC =================
async function initGithubConfig() {
  try {
    const conf = await window.api.getGithubConfig();
    if (conf) {
      if (conf.token) elTxtGithubToken.value = conf.token;
      if (conf.gistId) elTxtGithubGistId.value = conf.gistId;
    }
  } catch (e) {}
}

elBtnToggleTokenVisibility.addEventListener('click', () => {
  elTxtGithubToken.type = elTxtGithubToken.type === 'password' ? 'text' : 'password';
});

elBtnSyncUpload.addEventListener('click', async () => {
  const token = elTxtGithubToken.value.trim();
  const gistId = elTxtGithubGistId.value.trim();

  if (!token) {
    alert('Vui lòng nhập GitHub Personal Access Token (PAT) có quyền "gist".');
    elTxtGithubToken.focus();
    return;
  }

  updateFooterLog('Đang đồng bộ profiles lên GitHub Gist Cloud...');
  elBtnSyncUpload.disabled = true;
  elBtnSyncUpload.textContent = '⏳ Đang tải lên...';

  try {
    const res = await window.api.syncGithubUpload({ token, gistId });
    if (res.success) {
      elTxtGithubGistId.value = res.gistId;
      updateFooterLog(res.message);
      alert(`ĐỒNG BỘ GITHUB THÀNH CÔNG!\n\n${res.message}\n\nMã Gist ID của bạn: ${res.gistId}\nBạn có thể dùng mã này trên máy tính khác để tải cấu hình về bất cứ lúc nào.`);
    } else {
      updateFooterLog(`Lỗi đồng bộ: ${res.message}`);
      alert(`Không thể đồng bộ lên GitHub: ${res.message}`);
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    elBtnSyncUpload.disabled = false;
    elBtnSyncUpload.textContent = '⬆️ ĐẨY LÊN GITHUB (UPLOAD CLOUD)';
  }
});

elBtnSyncDownload.addEventListener('click', async () => {
  const gistId = elTxtGithubGistId.value.trim();
  const token = elTxtGithubToken.value.trim();

  if (!gistId) {
    alert('Vui lòng nhập Gist ID cần tải về.');
    elTxtGithubGistId.focus();
    return;
  }

  updateFooterLog(`Đang tải profiles từ GitHub Gist (${gistId})...`);
  elBtnSyncDownload.disabled = true;
  elBtnSyncDownload.textContent = '⏳ Đang tải về...';

  try {
    const res = await window.api.syncGithubDownload({ gistId, token });
    if (res.success) {
      updateFooterLog(res.message);
      await loadProfiles();
      alert(`TẢI VỀ THÀNH CÔNG!\n\n${res.message}\nĐã nạp toàn bộ profile game mới nhất.`);
    } else {
      updateFooterLog(`Lỗi tải về: ${res.message}`);
      alert(`Không thể tải về từ GitHub: ${res.message}`);
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    elBtnSyncDownload.disabled = false;
    elBtnSyncDownload.textContent = '⬇️ TẢI VỀ TỪ GITHUB (DOWNLOAD CLOUD)';
  }
});

// JSON Backup
elBtnExportJson.addEventListener('click', async () => {
  const res = await window.api.exportProfiles();
  if (res.success) {
    elTxtImportJson.value = res.json;
    navigator.clipboard.writeText(res.json);
    updateFooterLog('Đã sao chép nội dung JSON profiles vào Clipboard!');
    alert('Đã sao chép toàn bộ dữ liệu cấu hình vào bộ nhớ tạm (Clipboard)!');
  }
});

elBtnSaveJsonFile.addEventListener('click', async () => {
  const res = await window.api.exportProfiles();
  if (res.success) {
    const blob = new Blob([res.json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pandakeyauto_profiles_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    updateFooterLog('Đã xuất tệp profiles.json về máy tính!');
  }
});

elBtnImportJson.addEventListener('click', async () => {
  const raw = elTxtImportJson.value.trim();
  if (!raw) {
    alert('Vui lòng dán nội dung JSON vào khung.');
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const res = await window.api.importProfiles(parsed);
    if (res.success) {
      await loadProfiles();
      alert('Đã khôi phục thành công danh sách Profiles từ JSON!');
      updateFooterLog('Đã khôi phục Profiles từ JSON!');
    } else {
      alert('Định dạng JSON không tương thích với ứng dụng.');
    }
  } catch (e) {
    alert('Dữ liệu không phải JSON hợp lệ: ' + e.message);
  }
});

function renderProfilesOverview() {
  if (!profilesData || !profilesData.profiles) return;
  elProfileListOverview.innerHTML = '';
  profilesData.profiles.forEach(p => {
    const item = document.createElement('div');
    item.className = 'profile-overview-item';
    const modeNames = p.modes.map(m => m.name).join(' • ');
    
    let deleteBtnHtml = '';
    if (profilesData.profiles.length > 1) {
      deleteBtnHtml = `<button class="btn-delete-game" data-id="${p.id}" title="Xóa profile game này">🗑️ Xóa</button>`;
    }

    item.innerHTML = `
      <div class="profile-overview-left">
        <div class="profile-overview-title">${p.icon} ${p.name} <span style="font-size:0.68rem; color:#60a5fa;">(${p.category})</span></div>
        <div class="profile-overview-modes">${p.modes.length} chế độ: ${modeNames}</div>
      </div>
      <div>
        ${deleteBtnHtml}
      </div>
    `;

    const delBtn = item.querySelector('.btn-delete-game');
    if (delBtn) {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Bạn có chắc chắn muốn xóa profile "${p.name}"?`)) {
          const res = await window.api.deleteProfile(p.id);
          if (res.success) {
            updateFooterLog(`Đã xóa profile game: ${p.name}`);
            await loadProfiles();
          }
        }
      });
    }

    elProfileListOverview.appendChild(item);
  });
}

// ================= ĐIỀU KHIỂN CỬA SỔ MINI 200X200 & DRAWER =================
const elBtnToggleOrb = document.getElementById('btnToggleOrb');
const elMiniContainer = document.getElementById('miniContainer');
const elMiniOrbView = document.getElementById('miniOrbView');

async function handleToggleOrb() {
  if (window.api && window.api.toggleOrbMode) {
    const res = await window.api.toggleOrbMode();
    if (res && typeof res.isOrbMode === 'boolean') {
      if (elMiniContainer) {
        elMiniContainer.classList.toggle('orb-mode', res.isOrbMode);
      document.body.classList.toggle('orb-body', res.isOrbMode);
      }
      playSoundCue('mode');
      updateFooterLog(res.isOrbMode ? '🔮 Đã bật chế độ Quả Cầu Nổi (Orb Mode 44px)' : 'Đã khôi phục HUD Mini (200x200px)');
    }
  }
}

if (elBtnToggleOrb) {
  elBtnToggleOrb.addEventListener('click', handleToggleOrb);
}

if (elMiniOrbView) {
  elMiniOrbView.addEventListener('click', handleToggleOrb);
  elMiniOrbView.addEventListener('dblclick', handleToggleOrb);
}

const elOrbCore = document.querySelector('.orb-core');
if (elOrbCore) {
  elOrbCore.addEventListener('click', (e) => {
    e.stopPropagation();
    handleToggleOrb();
  });
  elOrbCore.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    handleToggleOrb();
  });
}

if (window.api && window.api.onToggleOrb) {
  window.api.onToggleOrb(() => handleToggleOrb());
}

if (elBtnMinWindow) {
  elBtnMinWindow.addEventListener('click', () => {
    if (window.api && window.api.minimizeWindow) window.api.minimizeWindow();
  });
}

if (elBtnCloseWindow) {
  elBtnCloseWindow.addEventListener('click', () => {
    if (window.api && window.api.closeWindow) window.api.closeWindow();
  });
}

let isPinned = true;
if (elBtnPinWindow) {
  elBtnPinWindow.classList.add('pinned');
  elBtnPinWindow.addEventListener('click', async () => {
    if (window.api && window.api.toggleAlwaysOnTop) {
      isPinned = await window.api.toggleAlwaysOnTop();
      elBtnPinWindow.classList.toggle('pinned', isPinned);
      updateFooterLog(isPinned ? '📌 Đã ghim cửa sổ luôn trên cùng' : 'Đã bỏ ghim cửa sổ');
    }
  });
}

if (elBtnToggleExpand) {
  elBtnToggleExpand.addEventListener('click', async () => {
    if (window.api && window.api.toggleWindowSize) {
      const res = await window.api.toggleWindowSize();
      if (res && res.expanded) {
        if (settingsDrawer) settingsDrawer.classList.add('open');
        updateFooterLog('⤢ Đã mở rộng cửa sổ (380x480px)');
      } else {
        if (settingsDrawer) settingsDrawer.classList.remove('open');
        updateFooterLog('Thu gọn kích thước mini (200x200px)');
      }
    }
  });
}

if (elBtnOpenDrawer) {
  elBtnOpenDrawer.addEventListener('click', () => {
    if (settingsDrawer) settingsDrawer.classList.add('open');
  });
}

if (elBtnCloseDrawer) {
  elBtnCloseDrawer.addEventListener('click', () => {
    if (settingsDrawer) settingsDrawer.classList.remove('open');
  });
}

// Bật / Tắt HUD Phím Ảo
let isKeymapHudActive = false;
if (elBtnToggleKeymapHud) {
  elBtnToggleKeymapHud.addEventListener('click', async () => {
    isKeymapHudActive = !isKeymapHudActive;
    if (window.api && window.api.toggleKeymapOverlay) {
      await window.api.toggleKeymapOverlay(isKeymapHudActive);
    }
    elBtnToggleKeymapHud.classList.toggle('active', isKeymapHudActive);
    updateFooterLog(`⌨️ HUD Phím Ảo Trong Game: ${isKeymapHudActive ? 'BẬT' : 'TẮT'}`);
    playSoundCue('activate');
  });
}

// Elements cho toggle switches VIP
const elBtnSwitchCooler = document.getElementById('btnSwitchCooler');
const elLblCoolerState = document.getElementById('lblCoolerState');
const elBtnSwitchRapidFire = document.getElementById('btnSwitchRapidFire');
const elLblRapidState = document.getElementById('lblRapidState');

function updateCoolerSwitchUI(active) {
  if (elBtnSwitchCooler) {
    if (active) elBtnSwitchCooler.classList.add('active');
    else elBtnSwitchCooler.classList.remove('active');
  }
  if (elLblCoolerState) {
    elLblCoolerState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblCoolerState.classList.add('active');
    else elLblCoolerState.classList.remove('active');
  }
}

function updateRapidSwitchUI(active) {
  if (elBtnSwitchRapidFire) {
    if (active) elBtnSwitchRapidFire.classList.add('active');
    else elBtnSwitchRapidFire.classList.remove('active');
  }
  if (elLblRapidState) {
    elLblRapidState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblRapidState.classList.add('active');
    else elLblRapidState.classList.remove('active');
  }
}

if (elBtnSwitchCooler) {
  elBtnSwitchCooler.addEventListener('click', () => {
    if (elBtnToggleCooler) elBtnToggleCooler.click();
  });
}

if (elBtnSwitchRapidFire) {
  elBtnSwitchRapidFire.addEventListener('click', () => {
    if (elBtnToggleRapidFire) elBtnToggleRapidFire.click();
  });
}

// ================= VIP TẢN NHIỆT ĐIỆN THOẠI =================
elBtnToggleCooler.addEventListener('click', async () => {
  isCoolerActive = !isCoolerActive;
  const res = await window.api.togglePhoneCooler({ deviceId: currentDeviceId, enable: isCoolerActive });
  if (res.success) {
    updateCoolerSwitchUI(res.coolerActive);
    if (res.coolerActive) {
      elBtnToggleCooler.classList.add('active');
      elBtnToggleCooler.textContent = '☀️ TẮT TẢN NHIỆT (KHÔI PHỤC ĐỘ SÁNG)';
      elCoolerStatusBadge.textContent = '❄️ Màn hình ĐT đã hạ tối đa - Máy đang mát lạnh';
      updateFooterLog(res.message);
    } else {
      elBtnToggleCooler.classList.remove('active');
      elBtnToggleCooler.textContent = '❄️ BẬT TẢN NHIỆT (HẠ ĐỘ SÁNG MÀN ĐT VỀ 0)';
      elCoolerStatusBadge.textContent = 'Đang bình thường';
      updateFooterLog(res.message);
    }
  }
});

// ================= 🚀 VIP: GAME BOOSTER 1-CLICK =================
if (elBtnBoostDevice) {
  elBtnBoostDevice.addEventListener('click', async () => {
    updateFooterLog('Đang kích hoạt Game Booster via ADB...');
    playSoundCue('activate');
    const res = await window.api.boostDevice({ deviceId: currentDeviceId });
    updateFooterLog(res.message);
    alert(res.message);
  });
}

if (elBtnRestoreAnim) {
  elBtnRestoreAnim.addEventListener('click', async () => {
    updateFooterLog('Đang khôi phục hiệu ứng chuyển động Android...');
    const res = await window.api.restoreDeviceAnim({ deviceId: currentDeviceId });
    updateFooterLog(res.message);
    alert(res.message);
  });
}

// ================= 🔫 VIP: RAPID FIRE MACRO =================
if (elBtnToggleRapidFire) {
  elBtnToggleRapidFire.addEventListener('click', async () => {
    isRapidFireActive = !isRapidFireActive;
    const cps = elSelRapidCps ? parseInt(elSelRapidCps.value) : 16;
    const res = await window.api.toggleRapidFire({ enabled: isRapidFireActive, clicksPerSec: cps });
    updateRapidSwitchUI(res.enabled);
    if (res.enabled) {
      elBtnToggleRapidFire.classList.add('active');
      elBtnToggleRapidFire.textContent = '🛑 DỪNG RAPID FIRE MACRO';
      updateFooterLog(res.message);
    } else {
      elBtnToggleRapidFire.classList.remove('active');
      elBtnToggleRapidFire.textContent = '🔫 BẬT RAPID FIRE MACRO';
      updateFooterLog(res.message);
    }
  });
}

// ================= PANDA MOUSE PRO & UTILITIES =================
elBtnActivatePanda.addEventListener('click', async () => {
  updateFooterLog('Đang gửi lệnh kích hoạt Panda Mouse Pro...');
  playSoundCue('activate');
  const res = await window.api.activatePanda({ deviceId: currentDeviceId });
  updateFooterLog(res.message);
  alert(res.message);
});

elBtnSendText.addEventListener('click', async () => {
  const text = elTxtSendText.value;
  if (!text) return;
  const res = await window.api.sendTextToPhone({ deviceId: currentDeviceId, text });
  if (res.success) {
    updateFooterLog('Đã gửi văn bản vào điện thoại!');
    elTxtSendText.value = '';
  }
});

elBtnScreenshot.addEventListener('click', async () => {
  updateFooterLog('Đang chụp màn hình điện thoại...');
  const res = await window.api.takeScreenshot({ deviceId: currentDeviceId });
  updateFooterLog(res.message);
  alert(res.message);
});

elBtnOpenUrl.addEventListener('click', async () => {
  const url = elTxtUrl.value.trim();
  if (!url) return;
  const targetUrl = url.startsWith('http') ? url : `https://${url}`;
  const res = await window.api.openUrlOnPhone({ deviceId: currentDeviceId, url: targetUrl });
  updateFooterLog(res.message);
});

document.querySelectorAll('.btn-quick').forEach(btn => {
  btn.addEventListener('click', async () => {
    const keycode = btn.getAttribute('data-key');
    await window.api.sendKeyEvent({ deviceId: currentDeviceId, keycode });
    updateFooterLog(`Đã gửi mã phím Android: ${keycode}`);
  });
});

elBtnRestartAdb.addEventListener('click', async () => {
  updateFooterLog('Đang khởi động lại ADB Server...');
  const res = await window.api.restartAdb();
  updateFooterLog(res.message);
  updateDeviceList();
});

elBtnRefresh.addEventListener('click', () => {
  updateDeviceList();
  updateFooterLog('Đã quét lại danh sách cổng kết nối.');
});

// ================= 🎯 RECOIL CONTROL (GHÌM TÂM TỰ ĐỘNG) =================
let isRecoilActive = false;
const elBtnToggleRecoil = document.getElementById('btnToggleRecoil');
const elLblRecoilState = document.getElementById('lblRecoilState');
const elBtnToggleRecoilQuick = document.getElementById('btnToggleRecoilQuick');
const elLblRecoilStateQuick = document.getElementById('lblRecoilStateQuick');
const elRngRecoilY = document.getElementById('rngRecoilY');
const elLblRecoilY = document.getElementById('lblRecoilY');
const elRngRecoilJitter = document.getElementById('rngRecoilJitter');
const elLblRecoilJitter = document.getElementById('lblRecoilJitter');
const elRngRecoilDelay = document.getElementById('rngRecoilDelay');
const elLblRecoilDelay = document.getElementById('lblRecoilDelay');

function updateRecoilUI() {
  if (elBtnToggleRecoil) {
    if (isRecoilActive) elBtnToggleRecoil.classList.add('active');
    else elBtnToggleRecoil.classList.remove('active');
  }
  if (elLblRecoilState) {
    elLblRecoilState.textContent = isRecoilActive ? 'BẬT' : 'TẮT';
    if (isRecoilActive) elLblRecoilState.classList.add('active');
    else elLblRecoilState.classList.remove('active');
  }
  if (elBtnToggleRecoilQuick) {
    if (isRecoilActive) elBtnToggleRecoilQuick.classList.add('active');
    else elBtnToggleRecoilQuick.classList.remove('active');
  }
  if (elLblRecoilStateQuick) {
    elLblRecoilStateQuick.textContent = isRecoilActive ? 'BẬT' : 'TẮT';
    if (isRecoilActive) elLblRecoilStateQuick.classList.add('active');
    else elLblRecoilStateQuick.classList.remove('active');
  }
}

async function handleToggleRecoil(forceState) {
  isRecoilActive = forceState !== undefined ? forceState : !isRecoilActive;
  updateRecoilUI();
  playSoundCue('activate');
  const pullY = parseInt(elRngRecoilY ? elRngRecoilY.value : 4) || 4;
  const jitterX = parseInt(elRngRecoilJitter ? elRngRecoilJitter.value : 1) || 1;
  const delayMs = parseInt(elRngRecoilDelay ? elRngRecoilDelay.value : 120) || 120;
  const res = await window.api.toggleRecoil({ enabled: isRecoilActive, pullY, jitterX, delayMs, intervalMs: 25 });
  updateFooterLog(res.message);
}

if (elBtnToggleRecoil) {
  elBtnToggleRecoil.addEventListener('click', () => handleToggleRecoil());
}

if (elLblRecoilState) {
  elLblRecoilState.style.cursor = 'pointer';
  elLblRecoilState.addEventListener('click', () => handleToggleRecoil());
}

if (elBtnToggleRecoilQuick) {
  elBtnToggleRecoilQuick.addEventListener('click', () => handleToggleRecoil());
}

if (elLblRecoilStateQuick) {
  elLblRecoilStateQuick.style.cursor = 'pointer';
  elLblRecoilStateQuick.addEventListener('click', () => handleToggleRecoil());
}

if (window.api && window.api.onRecoilToggled) {
  window.api.onRecoilToggled((active) => {
    isRecoilActive = !!active;
    updateRecoilUI();
  });
}

if (elRngRecoilY) {
  elRngRecoilY.addEventListener('input', () => {
    if (elLblRecoilY) elLblRecoilY.textContent = `${elRngRecoilY.value} px`;
    window.api.updateRecoilConfig({ pullY: parseInt(elRngRecoilY.value) });
  });
}

if (elRngRecoilJitter) {
  elRngRecoilJitter.addEventListener('input', () => {
    if (elLblRecoilJitter) elLblRecoilJitter.textContent = `±${elRngRecoilJitter.value} px`;
    window.api.updateRecoilConfig({ jitterX: parseInt(elRngRecoilJitter.value) });
  });
}

if (elRngRecoilDelay) {
  elRngRecoilDelay.addEventListener('input', () => {
    if (elLblRecoilDelay) elLblRecoilDelay.textContent = `${elRngRecoilDelay.value} ms`;
    window.api.updateRecoilConfig({ delayMs: parseInt(elRngRecoilDelay.value) });
  });
}

// Ghìm tâm điều khiển qua giao diện hoặc nút bấm

// ================= 📱 KÉO GIÃN MÀN HÌNH TỈ LỆ IPAD (4:3) =================
const elSelIpadPreset = document.getElementById('selIpadPreset');
const elBoxIpadCustom = document.getElementById('boxIpadCustom');
const elTxtIpadWidth = document.getElementById('txtIpadWidth');
const elTxtIpadHeight = document.getElementById('txtIpadHeight');
const elTxtIpadDensity = document.getElementById('txtIpadDensity');
const elBtnApplyIpadView = document.getElementById('btnApplyIpadView');
const elBtnResetIpadView = document.getElementById('btnResetIpadView');
const elIpadViewStatus = document.getElementById('ipadViewStatus');
const elBtnToggleIpadSwitch = document.getElementById('btnToggleIpadSwitch');
const elLblIpadState = document.getElementById('lblIpadState');

let isIpadActive = false;

function updateIpadSwitchUI(active) {
  isIpadActive = active;
  if (elBtnToggleIpadSwitch) {
    if (active) elBtnToggleIpadSwitch.classList.add('active');
    else elBtnToggleIpadSwitch.classList.remove('active');
  }
  if (elLblIpadState) {
    elLblIpadState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblIpadState.classList.add('active');
    else elLblIpadState.classList.remove('active');
  }
}

if (elBtnToggleIpadSwitch) {
  elBtnToggleIpadSwitch.addEventListener('click', () => {
    if (!isIpadActive) {
      if (elBtnApplyIpadView) elBtnApplyIpadView.click();
    } else {
      if (elBtnResetIpadView) elBtnResetIpadView.click();
    }
  });
}

if (elLblIpadState) {
  elLblIpadState.style.cursor = 'pointer';
  elLblIpadState.addEventListener('click', () => {
    if (elBtnToggleIpadSwitch) elBtnToggleIpadSwitch.click();
  });
}

if (elSelIpadPreset) {
  elSelIpadPreset.addEventListener('change', () => {
    if (elSelIpadPreset.value === 'custom') {
      if (elBoxIpadCustom) elBoxIpadCustom.style.display = 'grid';
    } else {
      if (elBoxIpadCustom) elBoxIpadCustom.style.display = 'none';
    }
  });
}

if (elBtnApplyIpadView) {
  elBtnApplyIpadView.addEventListener('click', async () => {
    let width = 1080, height = 2520, density = 420;
    let modeTitle = '21:9 UltraWide Gaming';

    if (elSelIpadPreset.value === 'custom') {
      width = parseInt(elTxtIpadWidth.value) || 1080;
      height = parseInt(elTxtIpadHeight.value) || 2520;
      density = parseInt(elTxtIpadDensity.value) || 420;
      modeTitle = `Tùy Chỉnh (${width}×${height})`;
    } else {
      const parts = elSelIpadPreset.value.split('x');
      width = parseInt(parts[0]) || 1080;
      height = parseInt(parts[1]) || 2520;

      if (width === 1080 && height === 2520) {
        density = 420;
        modeTitle = '21:9 UltraWide Gaming';
      } else if (width === 1440 && height === 3360) {
        density = 540;
        modeTitle = '21:9 UltraWide 2K';
      } else if (width === 1440 && height === 1920) {
        density = 320;
        modeTitle = 'iPad Pro 4:3';
      } else if (width === 1536 && height === 2048) {
        density = 360;
        modeTitle = 'iPad Retina 4:3';
      } else if (width === 1080 && height === 1920) {
        density = 400;
        modeTitle = 'Esports 16:9';
      } else {
        density = (width >= 1440) ? 440 : 360;
        modeTitle = `${width}×${height}`;
      }
    }

    updateFooterLog(`📐 Đang can thiệp SurfaceFlinger sang [${modeTitle}]...`);
    const res = await window.api.setIpadView({ width, height, density, deviceId: currentDeviceId, modeTitle });
    updateFooterLog(res.message);
    if (res.success) {
      if (elIpadViewStatus) {
        elIpadViewStatus.textContent = modeTitle;
        elIpadViewStatus.classList.add('active');
      }
      updateIpadSwitchUI(true);
      playSoundCue('activate');
    } else {
      updateIpadSwitchUI(false);
      updateFooterLog('⚠️ Không thể chỉnh màn hình: Vui lòng kết nối cáp USB với điện thoại!');
    }
  });
}

if (elBtnResetIpadView) {
  elBtnResetIpadView.addEventListener('click', async () => {
    updateFooterLog('Đang khôi phục màn hình điện thoại về mặc định...');
    const res = await window.api.resetIpadView({ deviceId: currentDeviceId });
    updateFooterLog(res.message);
    if (elIpadViewStatus) {
      elIpadViewStatus.textContent = 'Tỉ lệ gốc';
      elIpadViewStatus.classList.remove('active');
    }
    updateIpadSwitchUI(false);
  });
}

// ================= 🔁 AUTO FARM / TOUCH MACRO RECORDER =================
const elBtnToggleRecordMacro = document.getElementById('btnToggleRecordMacro');
const elBtnPlayMacro = document.getElementById('btnPlayMacro');
const elSelMacroLoop = document.getElementById('selMacroLoop');
const elSelMacroSpeed = document.getElementById('selMacroSpeed');
const elMacroStatus = document.getElementById('macroStatus');
const elBtnToggleMacroPlay = document.getElementById('btnToggleMacroPlay');
const elLblMacroState = document.getElementById('lblMacroState');

let isRecordingMacro = false;
let isPlayingMacro = false;
let localMacroEvents = [];
let macroRecordStartTime = 0;

function updateMacroSwitchUI(active) {
  if (elBtnToggleMacroPlay) {
    if (active) elBtnToggleMacroPlay.classList.add('active');
    else elBtnToggleMacroPlay.classList.remove('active');
  }
  if (elLblMacroState) {
    elLblMacroState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblMacroState.classList.add('active');
    else elLblMacroState.classList.remove('active');
  }
}

if (elBtnToggleMacroPlay) {
  elBtnToggleMacroPlay.addEventListener('click', () => {
    if (elBtnPlayMacro) elBtnPlayMacro.click();
  });
}

if (elBtnToggleRecordMacro) {
  elBtnToggleRecordMacro.addEventListener('click', async () => {
    if (!isRecordingMacro) {
      isRecordingMacro = true;
      localMacroEvents = [];
      macroRecordStartTime = Date.now();
      elBtnToggleRecordMacro.classList.add('recording');
      elBtnToggleRecordMacro.textContent = '⏹ DỪNG GHI';
      if (elMacroStatus) {
        elMacroStatus.textContent = 'Đang ghi thao tác...';
        elMacroStatus.classList.add('active');
      }
      await window.api.startMacroRecord();
      updateFooterLog('🔴 Bắt đầu ghi thao tác chuột! Hãy click trên màn hình game.');
    } else {
      isRecordingMacro = false;
      elBtnToggleRecordMacro.classList.remove('recording');
      elBtnToggleRecordMacro.textContent = '🔴 Bắt Đầu Ghi';
      const res = await window.api.stopMacroRecord();
      const count = localMacroEvents.length;
      if (elMacroStatus) {
        elMacroStatus.textContent = count > 0 ? `Đã lưu ${count} thao tác` : 'Chưa có bản ghi';
        if (count === 0) elMacroStatus.classList.remove('active');
      }
      if (elBtnPlayMacro) elBtnPlayMacro.disabled = (count === 0);
      updateFooterLog(`⏹ Đã hoàn tất ghi! Tổng cộng: ${count} thao tác.`);
    }
  });
}

// Lắng nghe click trong cửa sổ khi đang ghi macro
window.addEventListener('mousedown', (e) => {
  if (isRecordingMacro) {
    const now = Date.now();
    const delay = localMacroEvents.length === 0 ? 100 : Math.min(3000, now - macroRecordStartTime);
    macroRecordStartTime = now;
    localMacroEvents.push({
      type: 'tap',
      x: e.clientX,
      y: e.clientY,
      delay: Math.max(50, delay)
    });
    if (elMacroStatus) {
      elMacroStatus.textContent = `Đang ghi: ${localMacroEvents.length} cú nhấp`;
    }
  }
});

if (elBtnPlayMacro) {
  elBtnPlayMacro.addEventListener('click', async () => {
    if (!isPlayingMacro) {
      if (localMacroEvents.length === 0) return alert('Chưa có thao tác nào được ghi!');
      isPlayingMacro = true;
      elBtnPlayMacro.textContent = '⏹ DỪNG PHÁT';
      updateMacroSwitchUI(true);
      const loopCount = parseInt(elSelMacroLoop ? elSelMacroLoop.value : 5) || 5;
      const speed = parseFloat(elSelMacroSpeed ? elSelMacroSpeed.value : 1.0) || 1.0;
      updateFooterLog(`▶ Đang tự động phát lại ${localMacroEvents.length} thao tác (Lặp: ${loopCount}, Tốc độ: ${speed}x)...`);
      const res = await window.api.playMacro({
        events: localMacroEvents,
        loopCount,
        speed,
        cooldownMs: 800,
        deviceId: currentDeviceId
      });
      updateFooterLog(res.message);
      isPlayingMacro = false;
      elBtnPlayMacro.textContent = '▶ Phát Lại';
      updateMacroSwitchUI(false);
    } else {
      isPlayingMacro = false;
      elBtnPlayMacro.textContent = '▶ Phát Lại';
      updateMacroSwitchUI(false);
      const res = await window.api.stopMacroPlay();
      updateFooterLog(res.message);
    }
  });
}

// ================= ⚡ HARDWARE & BATTERY HUD =================
const elBtnRefreshBattery = document.getElementById('btnRefreshBattery');
const elHudTemp = document.getElementById('hudTemp');
const elHudTempBadge = document.getElementById('hudTempBadge');
const elHudLevel = document.getElementById('hudLevel');
const elHudBatteryFill = document.getElementById('hudBatteryFill');
const elHudStatus = document.getElementById('hudStatus');
const elHudVoltage = document.getElementById('hudVoltage');
const elHudHealth = document.getElementById('hudHealth');
const elHudPowerSource = document.getElementById('hudPowerSource');
const elBtnToggleBypassCharging = document.getElementById('btnToggleBypassCharging');
const elBypassStatus = document.getElementById('bypassStatus');
const elBtnSet120Hz = document.getElementById('btnSet120Hz');
const elBtnSet90Hz = document.getElementById('btnSet90Hz');
const elReset60Hz = document.getElementById('btnReset60Hz');

let isBypassChargingActive = false;

async function refreshBatteryStats() {
  if (!currentDeviceId) return;
  try {
    const res = await window.api.getBatteryInfo({ deviceId: currentDeviceId });
    if (res.success && res.battery) {
      const b = res.battery;
      if (elHudLevel) elHudLevel.textContent = b.level;
      if (elHudBatteryFill) {
        elHudBatteryFill.style.width = `${b.level}%`;
        if (b.level <= 20) {
          elHudBatteryFill.style.background = 'linear-gradient(90deg, #ff3366, #f59e0b)';
        } else {
          elHudBatteryFill.style.background = 'linear-gradient(90deg, #00f2fe, #00f5d4)';
        }
      }
      if (elHudTemp) elHudTemp.textContent = b.tempC || '--';
      if (elHudTempBadge) {
        const temp = parseFloat(b.tempC) || 0;
        if (temp > 42) {
          elHudTempBadge.textContent = 'Quá Nhiệt (>42°C)';
          elHudTempBadge.className = 'metric-badge badge-hot';
        } else if (temp > 38) {
          elHudTempBadge.textContent = 'Hơi Ấm (38-42°C)';
          elHudTempBadge.className = 'metric-badge badge-warm';
        } else {
          elHudTempBadge.textContent = 'Mát Mẻ (<38°C)';
          elHudTempBadge.className = 'metric-badge badge-cool';
        }
      }
      if (elHudStatus) elHudStatus.textContent = b.status || 'Bình thường';
      if (elHudVoltage) elHudVoltage.textContent = `Điện áp: ${b.voltage} mV`;
      if (elHudHealth) elHudHealth.textContent = b.health || 'Tốt';
      if (elHudPowerSource) {
        elHudPowerSource.textContent = b.acPowered ? 'Nguồn: Củ sạc nhanh AC' : (b.usbPowered ? 'Nguồn: Cổng USB PC' : 'Nguồn: Đang dùng pin');
      }
    }
  } catch (e) {}
}

if (elBtnRefreshBattery) {
  elBtnRefreshBattery.addEventListener('click', () => {
    updateFooterLog('Đang làm mới thông số pin & nhiệt độ...');
    refreshBatteryStats();
  });
}

const elBtnSwitchBypass = document.getElementById('btnSwitchBypass');
const elLblBypassState = document.getElementById('lblBypassState');

function updateBypassSwitchUI(active) {
  if (elBtnSwitchBypass) {
    if (active) elBtnSwitchBypass.classList.add('active');
    else elBtnSwitchBypass.classList.remove('active');
  }
  if (elLblBypassState) {
    elLblBypassState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblBypassState.classList.add('active');
    else elLblBypassState.classList.remove('active');
  }
}

if (elBtnSwitchBypass) {
  elBtnSwitchBypass.addEventListener('click', () => {
    if (elBtnToggleBypassCharging) elBtnToggleBypassCharging.click();
  });
}

if (elBtnToggleBypassCharging) {
  elBtnToggleBypassCharging.addEventListener('click', async () => {
    isBypassChargingActive = !isBypassChargingActive;
    updateFooterLog('Đang chuyển đổi trạng thái Bypass Charging...');
    const res = await window.api.toggleBypassCharging({ enabled: isBypassChargingActive, deviceId: currentDeviceId });
    updateBypassSwitchUI(res.enabled);
    if (res.enabled) {
      elBtnToggleBypassCharging.textContent = '⚡ KHÔI PHỤC SẠC PIN';
      elBtnToggleBypassCharging.classList.add('active');
      if (elBypassStatus) {
        elBypassStatus.textContent = 'Bypass (Chống Nóng 100%)';
        elBypassStatus.classList.add('active');
      }
    } else {
      elBtnToggleBypassCharging.textContent = '❄️ BẬT BYPASS CHARGING';
      elBtnToggleBypassCharging.classList.remove('active');
      if (elBypassStatus) {
        elBypassStatus.textContent = 'Sạc bình thường';
        elBypassStatus.classList.remove('active');
      }
    }
    updateFooterLog(res.message);
    refreshBatteryStats();
  });
}

if (elBtnSet120Hz) {
  elBtnSet120Hz.addEventListener('click', async () => {
    updateFooterLog('Đang ép tần số quét 120Hz qua ADB...');
    const res = await window.api.setRefreshRate({ rate: 120, deviceId: currentDeviceId });
    updateFooterLog(res.message);
    alert(res.message);
  });
}

if (elBtnSet90Hz) {
  elBtnSet90Hz.addEventListener('click', async () => {
    updateFooterLog('Đang ép tần số quét 90Hz qua ADB...');
    const res = await window.api.setRefreshRate({ rate: 90, deviceId: currentDeviceId });
    updateFooterLog(res.message);
    alert(res.message);
  });
}

if (elReset60Hz) {
  elReset60Hz.addEventListener('click', async () => {
    updateFooterLog('Đang khôi phục tần số quét 60Hz...');
    const res = await window.api.setRefreshRate({ rate: 'reset', deviceId: currentDeviceId });
    updateFooterLog(res.message);
    alert(res.message);
  });
}

// ================= 📦 FILE DRAG & DROP & 1-CLICK WIRELESS ADB =================
const elApkDropzone = document.getElementById('apkDropzone');
const elFilePickerInput = document.getElementById('filePickerInput');
const elBtnBrowseFile = document.getElementById('btnBrowseFile');
const elDropzoneProgress = document.getElementById('dropzoneProgress');
const elDropzoneProgressFill = document.getElementById('dropzoneProgressFill');
const elDropzoneProgressText = document.getElementById('dropzoneProgressText');
const elBtnActivateWirelessAdb = document.getElementById('btnActivateWirelessAdb');
const elWirelessStatusBadge = document.getElementById('wirelessStatusBadge');

async function handleFileProcess(file) {
  if (!file || !file.path) return;
  if (!currentDeviceId) {
    return alert('Chưa có điện thoại nào kết nối! Hãy cắm cáp USB trước.');
  }

  const isApk = file.name.toLowerCase().endsWith('.apk');
  if (elDropzoneProgress) elDropzoneProgress.style.display = 'block';
  if (elDropzoneProgressFill) elDropzoneProgressFill.style.width = '30%';
  if (elDropzoneProgressText) elDropzoneProgressText.textContent = isApk ? `Đang cài đặt ${file.name}...` : `Đang chép ${file.name}...`;

  if (isApk) {
    updateFooterLog(`📦 Đang nạp và cài đặt file APK: ${file.name}...`);
    const res = await window.api.installApk({ filePath: file.path, deviceId: currentDeviceId });
    if (elDropzoneProgressFill) elDropzoneProgressFill.style.width = '100%';
    if (elDropzoneProgressText) elDropzoneProgressText.textContent = res.success ? 'Cài đặt thành công!' : 'Lỗi cài đặt!';
    updateFooterLog(res.message);
    setTimeout(() => { if (elDropzoneProgress) elDropzoneProgress.style.display = 'none'; }, 3000);
    alert(res.message);
  } else {
    updateFooterLog(`📁 Đang chép file vào /sdcard/Download/: ${file.name}...`);
    const res = await window.api.pushFileToPhone({ filePath: file.path, deviceId: currentDeviceId });
    if (elDropzoneProgressFill) elDropzoneProgressFill.style.width = '100%';
    if (elDropzoneProgressText) elDropzoneProgressText.textContent = res.success ? 'Chép file thành công!' : 'Lỗi chép file!';
    updateFooterLog(res.message);
    setTimeout(() => { if (elDropzoneProgress) elDropzoneProgress.style.display = 'none'; }, 3000);
    alert(res.message);
  }
}

if (elApkDropzone) {
  ['dragenter', 'dragover'].forEach(name => {
    elApkDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      elApkDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    elApkDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      elApkDropzone.classList.remove('dragover');
    });
  });

  elApkDropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  });
}

if (elBtnBrowseFile && elFilePickerInput) {
  elBtnBrowseFile.addEventListener('click', () => elFilePickerInput.click());
  elFilePickerInput.addEventListener('change', () => {
    if (elFilePickerInput.files && elFilePickerInput.files.length > 0) {
      handleFileProcess(elFilePickerInput.files[0]);
    }
  });
}

if (elBtnActivateWirelessAdb) {
  elBtnActivateWirelessAdb.addEventListener('click', async () => {
    updateFooterLog('📡 Đang kích hoạt kết nối không dây qua cổng 5555...');
    elBtnActivateWirelessAdb.disabled = true;
    elBtnActivateWirelessAdb.textContent = '⏳ Đang dò IP và kết nối...';
    const res = await window.api.activateWirelessAdb({ deviceId: currentDeviceId });
    elBtnActivateWirelessAdb.disabled = false;
    elBtnActivateWirelessAdb.textContent = '📡 KÍCH HOẠT KHÔNG DÂY (RÚT CÁP)';
    if (res.success) {
      if (elWirelessStatusBadge) {
        elWirelessStatusBadge.textContent = `Không Dây (${res.ip}:5555)`;
        elWirelessStatusBadge.classList.add('active');
      }
      updateFooterLog(res.message);
      updateDeviceList();
      alert(`KẾT NỐI KHÔNG DÂY THÀNH CÔNG!\n\n${res.message}\n\nBạn có thể rút dây cáp USB ngay bây giờ mà vẫn tiếp tục chơi game và chiếu màn hình.`);
    } else {
      updateFooterLog(res.message);
      alert(res.message);
    }
  });
}

// ================= 🎥 STREAMER & CONTENT CREATOR =================
const elBtnOpenRecordings = document.getElementById('btnOpenRecordings');
const elBtnToggleShowTouches = document.getElementById('btnToggleShowTouches');
const elTouchesStatusBadge = document.getElementById('touchesStatusBadge');

let isShowTouchesActive = false;

if (elBtnOpenRecordings) {
  elBtnOpenRecordings.addEventListener('click', async () => {
    await window.api.openRecordingsFolder();
    updateFooterLog('Đã mở thư mục Recordings chứa video đã quay.');
  });
}

const elBtnSwitchTouches = document.getElementById('btnSwitchTouches');
const elLblTouchesState = document.getElementById('lblTouchesState');

function updateTouchesSwitchUI(active) {
  if (elBtnSwitchTouches) {
    if (active) elBtnSwitchTouches.classList.add('active');
    else elBtnSwitchTouches.classList.remove('active');
  }
  if (elLblTouchesState) {
    elLblTouchesState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblTouchesState.classList.add('active');
    else elLblTouchesState.classList.remove('active');
  }
}

if (elBtnSwitchTouches) {
  elBtnSwitchTouches.addEventListener('click', () => {
    if (elBtnToggleShowTouches) elBtnToggleShowTouches.click();
  });
}

if (elBtnToggleShowTouches) {
  elBtnToggleShowTouches.addEventListener('click', async () => {
    isShowTouchesActive = !isShowTouchesActive;
    updateFooterLog('Đang thay đổi cài đặt hiển thị chạm tay...');
    const res = await window.api.toggleShowTouches({ enabled: isShowTouchesActive, deviceId: currentDeviceId });
    updateTouchesSwitchUI(res.enabled);
    if (res.enabled) {
      elBtnToggleShowTouches.textContent = '⚪ TẮT HIỂN THỊ CHẠM';
      if (elTouchesStatusBadge) {
        elTouchesStatusBadge.textContent = 'Đang hiển thị';
        elTouchesStatusBadge.classList.add('active');
      }
    } else {
      elBtnToggleShowTouches.textContent = '⚪ BẬT HIỂN THỊ CHẠM TAY';
      if (elTouchesStatusBadge) {
        elTouchesStatusBadge.textContent = 'Đang tắt';
        elTouchesStatusBadge.classList.remove('active');
      }
    }
    updateFooterLog(res.message);
  });
}

// ================= 🎨 COMBAT ASSIST: COLOR AIM & ENEMY HIGHLIGHTER =================
const elBtnToggleColorAssist = document.getElementById('btnToggleColorAssist');
const elBtnSwitchColorAssist = document.getElementById('btnSwitchColorAssist');
const elLblColorAssistState = document.getElementById('lblColorAssistState');
const elColorAssistStatus = document.getElementById('colorAssistStatus');
const elRngFovSize = document.getElementById('rngFovSize');
const elLblFovSize = document.getElementById('lblFovSize');
const elRngSmoothSpeed = document.getElementById('rngSmoothSpeed');
const elLblSmoothSpeed = document.getElementById('lblSmoothSpeed');
const elSelEnemyFilter = document.getElementById('selEnemyFilter');
const elChkTriggerBot = document.getElementById('chkTriggerBot');

let isColorAssistActive = false;
let colorAssistSettings = {
  enabled: false,
  color: 'red',
  fovSize: 80,
  smoothSpeed: 5,
  triggerBot: false,
  filterMode: 'vibrance'
};

function updateColorAssistSwitchUI(active) {
  if (elBtnSwitchColorAssist) {
    if (active) elBtnSwitchColorAssist.classList.add('active');
    else elBtnSwitchColorAssist.classList.remove('active');
  }
  if (elLblColorAssistState) {
    elLblColorAssistState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblColorAssistState.classList.add('active');
    else elLblColorAssistState.classList.remove('active');
  }
}

if (elBtnSwitchColorAssist) {
  elBtnSwitchColorAssist.addEventListener('click', () => {
    if (elBtnToggleColorAssist) elBtnToggleColorAssist.click();
  });
}

if (elBtnToggleColorAssist) {
  elBtnToggleColorAssist.addEventListener('click', async () => {
    isColorAssistActive = !isColorAssistActive;
    colorAssistSettings.enabled = isColorAssistActive;
    updateColorAssistSwitchUI(isColorAssistActive);
    if (isColorAssistActive) {
      elBtnToggleColorAssist.textContent = '🛑 DỪNG COLOR AIM ASSIST';
      elBtnToggleColorAssist.classList.add('active');
      if (elColorAssistStatus) {
        elColorAssistStatus.textContent = `Đang bám mục tiêu: ${colorAssistSettings.color.toUpperCase()}`;
        elColorAssistStatus.classList.add('active');
      }
    } else {
      elBtnToggleColorAssist.textContent = '🎯 BẬT COLOR AIM ASSIST';
      elBtnToggleColorAssist.classList.remove('active');
      if (elColorAssistStatus) {
        elColorAssistStatus.textContent = 'Đang tắt';
        elColorAssistStatus.classList.remove('active');
      }
    }
    const res = await window.api.toggleColorAssist({ enabled: isColorAssistActive });
    updateFooterLog(`🎯 Color Aim Assist: ${isColorAssistActive ? 'ĐÃ KÍCH HOẠT' : 'ĐÃ TẮT'}`);
  });
}

document.querySelectorAll('.btn-color-tag').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-color-tag').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    colorAssistSettings.color = btn.getAttribute('data-color') || 'red';
    window.api.updateColorAssistConfig({ color: colorAssistSettings.color });
    updateFooterLog(`Đã đổi màu nhận diện mục tiêu sang: ${colorAssistSettings.color.toUpperCase()}`);
  });
});

if (elRngFovSize) {
  elRngFovSize.addEventListener('input', () => {
    if (elLblFovSize) elLblFovSize.textContent = `${elRngFovSize.value} px`;
    colorAssistSettings.fovSize = parseInt(elRngFovSize.value);
    window.api.updateColorAssistConfig({ fovSize: colorAssistSettings.fovSize });
  });
}

if (elRngSmoothSpeed) {
  elRngSmoothSpeed.addEventListener('input', () => {
    if (elLblSmoothSpeed) elLblSmoothSpeed.textContent = elRngSmoothSpeed.value;
    colorAssistSettings.smoothSpeed = parseInt(elRngSmoothSpeed.value);
    window.api.updateColorAssistConfig({ smoothSpeed: colorAssistSettings.smoothSpeed });
  });
}

if (elChkTriggerBot) {
  elChkTriggerBot.addEventListener('change', () => {
    colorAssistSettings.triggerBot = elChkTriggerBot.checked;
    window.api.updateColorAssistConfig({ triggerBot: elChkTriggerBot.checked });
    updateFooterLog(`Triggerbot tự động bắn: ${elChkTriggerBot.checked ? 'BẬT' : 'TẮT'}`);
  });
}

if (elSelEnemyFilter) {
  elSelEnemyFilter.addEventListener('change', () => {
    colorAssistSettings.filterMode = elSelEnemyFilter.value;
    window.api.updateColorAssistConfig({ filterMode: elSelEnemyFilter.value });
    updateFooterLog(`Đã áp dụng bộ lọc màu hiển thị: ${elSelEnemyFilter.options[elSelEnemyFilter.selectedIndex].text}`);
  });
}

// ================= 🎛️ BỘ LỌC BƯỚC CHÂN FPS (FOOTSTEP SOUND BOOSTER) =================
let isFootstepBoosterActive = false;
const elBtnToggleFootstepBooster = document.getElementById('btnToggleFootstepBooster');
const elLblFootstepBoosterState = document.getElementById('lblFootstepBoosterState');

if (elBtnToggleFootstepBooster) {
  elBtnToggleFootstepBooster.addEventListener('click', async () => {
    isFootstepBoosterActive = !isFootstepBoosterActive;
    if (elBtnToggleFootstepBooster) {
      if (isFootstepBoosterActive) elBtnToggleFootstepBooster.classList.add('active');
      else elBtnToggleFootstepBooster.classList.remove('active');
    }
    if (elLblFootstepBoosterState) {
      elLblFootstepBoosterState.textContent = isFootstepBoosterActive ? 'BẬT' : 'TẮT';
      if (isFootstepBoosterActive) elLblFootstepBoosterState.classList.add('active');
      else elLblFootstepBoosterState.classList.remove('active');
    }
    if (window.api && window.api.toggleFootstepBooster) {
      await window.api.toggleFootstepBooster(isFootstepBoosterActive);
    }
    updateFooterLog(`🎛️ Bộ lọc âm thanh bước chân FPS: ${isFootstepBoosterActive ? 'BẬT (250Hz - 2.5kHz)' : 'TẮT'}`);
    playSoundCue('activate');
  });
}

// ================= 👁️ KÍCH MÀU ĐỊCH & NHÌN ĐÊM (DIGITAL VIBRANCE) =================
let isDigitalVibranceActive = false;
const elBtnToggleDigitalVibrance = document.getElementById('btnToggleDigitalVibrance');
const elLblDigitalVibranceState = document.getElementById('lblDigitalVibranceState');

if (elBtnToggleDigitalVibrance) {
  elBtnToggleDigitalVibrance.addEventListener('click', async () => {
    isDigitalVibranceActive = !isDigitalVibranceActive;
    if (elBtnToggleDigitalVibrance) {
      if (isDigitalVibranceActive) elBtnToggleDigitalVibrance.classList.add('active');
      else elBtnToggleDigitalVibrance.classList.remove('active');
    }
    if (elLblDigitalVibranceState) {
      elLblDigitalVibranceState.textContent = isDigitalVibranceActive ? 'BẬT' : 'TẮT';
      if (isDigitalVibranceActive) elLblDigitalVibranceState.classList.add('active');
      else elLblDigitalVibranceState.classList.remove('active');
    }
    if (window.api && window.api.toggleDigitalVibrance) {
      await window.api.toggleDigitalVibrance({ forceState: isDigitalVibranceActive });
    }
    updateFooterLog(`👁️ Chế độ kích màu địch & nhìn đêm (Digital Vibrance): ${isDigitalVibranceActive ? 'BẬT' : 'TẮT'}`);
    playSoundCue('activate');
  });
}

// ================= 📡 1-CLICK WIRELESS ADB (KẾT NỐI KHÔNG DÂY) =================
const elBtnDetectIp = document.getElementById('btnDetectIp');
const elTxtWirelessIp = document.getElementById('txtWirelessIp');
const elTxtWirelessPort = document.getElementById('txtWirelessPort');

async function autoDetectPhoneIp() {
  if (!window.api || !window.api.getDeviceWifiIp) return;
  if (elWirelessStatusBadge) elWirelessStatusBadge.textContent = 'Đang dò IP Wi-Fi...';
  updateFooterLog('🔍 Đang tự động dò tìm địa chỉ IP Wi-Fi của điện thoại qua ADB...');

  try {
    const res = await window.api.getDeviceWifiIp();
    if (res && res.success && res.ip) {
      if (elTxtWirelessIp) elTxtWirelessIp.value = res.ip;
      if (elWirelessStatusBadge) elWirelessStatusBadge.textContent = `Tìm thấy IP: ${res.ip}`;
      updateFooterLog(`✅ Đã tìm thấy IP Wi-Fi điện thoại: ${res.ip}`);
    } else {
      if (elWirelessStatusBadge) elWirelessStatusBadge.textContent = 'Chưa tìm thấy IP Wi-Fi';
      updateFooterLog(res.message || 'Chưa tìm thấy IP Wi-Fi điện thoại');
    }
  } catch (e) {
    console.error(e);
  }
}

if (elBtnDetectIp) {
  elBtnDetectIp.addEventListener('click', autoDetectPhoneIp);
}

if (elBtnActivateWirelessAdb) {
  elBtnActivateWirelessAdb.addEventListener('click', async () => {
    let ip = elTxtWirelessIp ? elTxtWirelessIp.value.trim() : '';
    const port = parseInt(elTxtWirelessPort ? elTxtWirelessPort.value : 5555) || 5555;

    if (!ip) {
      await autoDetectPhoneIp();
      ip = elTxtWirelessIp ? elTxtWirelessIp.value.trim() : '';
    }

    if (!ip) {
      alert('Vui lòng nhập địa chỉ IP Wi-Fi của điện thoại (VD: 192.168.1.50) hoặc đảm bảo điện thoại đã kết nối Wi-Fi.');
      return;
    }

    if (elWirelessStatusBadge) elWirelessStatusBadge.textContent = 'Đang kết nối không dây...';
    updateFooterLog(`📶 Đang kết nối không dây tới: ${ip}:${port}...`);

    try {
      const res = await window.api.connectWirelessAdb({ ip, port });
      if (res && res.success) {
        if (elWirelessStatusBadge) {
          elWirelessStatusBadge.textContent = `Đã kết nối Wi-Fi: ${ip}`;
          elWirelessStatusBadge.classList.add('active');
        }
        updateFooterLog(res.message);
        alert(`Kết nối không dây thành công!\n\nĐịa chỉ: ${ip}:${port}\nBây giờ bạn có thể rút cáp USB và chơi game thoải mái!`);
        playSoundCue('activate');
        updateDeviceList();
      } else {
        if (elWirelessStatusBadge) elWirelessStatusBadge.textContent = 'Lỗi kết nối';
        alert(`Không thể kết nối không dây: ${res.message || 'Lỗi không xác định'}`);
      }
    } catch (e) {
      alert(`Lỗi: ${e.message}`);
    }
  });
}

// ================= 🎯 QUICK-SWITCH SNIPER (AWM SIÊU TỐC) =================
let isQuickSniperActive = false;
const elBtnToggleQuickSniper = document.getElementById('btnToggleQuickSniper');
const elLblQuickSniperState = document.getElementById('lblQuickSniperState');
const elBtnTestQuickSniper = document.getElementById('btnTestQuickSniper');
const elQuickSniperStatus = document.getElementById('quickSniperStatus');

function updateQuickSniperUI() {
  if (elBtnToggleQuickSniper) {
    if (isQuickSniperActive) elBtnToggleQuickSniper.classList.add('active');
    else elBtnToggleQuickSniper.classList.remove('active');
  }
  if (elLblQuickSniperState) {
    elLblQuickSniperState.textContent = isQuickSniperActive ? 'BẬT' : 'TẮT';
    if (isQuickSniperActive) elLblQuickSniperState.classList.add('active');
    else elLblQuickSniperState.classList.remove('active');
  }
  if (elQuickSniperStatus) {
    elQuickSniperStatus.textContent = isQuickSniperActive ? 'Đang kích hoạt' : 'Sẵn sàng';
    if (isQuickSniperActive) elQuickSniperStatus.classList.add('active');
    else elQuickSniperStatus.classList.remove('active');
  }
}

if (elBtnToggleQuickSniper) {
  elBtnToggleQuickSniper.addEventListener('click', async () => {
    isQuickSniperActive = !isQuickSniperActive;
    updateQuickSniperUI();
    if (window.api && window.api.toggleQuickSniper) {
      await window.api.toggleQuickSniper(isQuickSniperActive);
    }
    updateFooterLog(`🎯 Quick-Switch Sniper: ${isQuickSniperActive ? 'BẬT - Tự Đổi Súng Khi Bắn' : 'TẮT'}`);
    playSoundCue('activate');
  });
}

if (elBtnTestQuickSniper) {
  elBtnTestQuickSniper.addEventListener('click', async () => {
    if (window.api && window.api.triggerQuickSniper) {
      await window.api.triggerQuickSniper({ deviceId: currentDeviceId });
      updateFooterLog('⚡ [Sniper] Đã thử chuỗi đổi súng siêu tốc 0ms: Đổi Dao (3) ➔ Đổi Súng (1)');
      playSoundCue('activate');
    }
  });
}

if (window.api && window.api.onQuickSniperToggled) {
  window.api.onQuickSniperToggled((active) => {
    isQuickSniperActive = !!active;
    updateQuickSniperUI();
  });
}

// ================= 🛡️ TOURNAMENT CLUTCH SHIELD (CHẾ ĐỘ TẬP TRUNG) =================
let isClutchShieldActive = false;
const elBtnToggleClutchShield = document.getElementById('btnToggleClutchShield');
const elLblClutchShieldState = document.getElementById('lblClutchShieldState');

if (elBtnToggleClutchShield) {
  elBtnToggleClutchShield.addEventListener('click', async () => {
    isClutchShieldActive = !isClutchShieldActive;
    if (elBtnToggleClutchShield) {
      if (isClutchShieldActive) elBtnToggleClutchShield.classList.add('active');
      else elBtnToggleClutchShield.classList.remove('active');
    }
    if (elLblClutchShieldState) {
      elLblClutchShieldState.textContent = isClutchShieldActive ? 'BẬT' : 'TẮT';
      if (isClutchShieldActive) elLblClutchShieldState.classList.add('active');
      else elLblClutchShieldState.classList.remove('active');
    }
    if (window.api && window.api.toggleClutchShield) {
      await window.api.toggleClutchShield({ forceState: isClutchShieldActive, deviceId: currentDeviceId });
    }
    updateFooterLog(`🛡️ Chế độ tập trung thi đấu (Clutch Shield): ${isClutchShieldActive ? 'BẬT (Chặn cuộc gọi & thông báo)' : 'TẮT'}`);
    playSoundCue('activate');
  });
}

// ================= 📸 INSTANT HIGHLIGHT SCREENSHOT =================
const elBtnCaptureInstantScreenshot = document.getElementById('btnCaptureInstantScreenshot');
const elBtnOpenScreenshotsFolder = document.getElementById('btnOpenScreenshotsFolder');
const elLblLatestScreenshot = document.getElementById('lblLatestScreenshot');

if (elBtnCaptureInstantScreenshot) {
  elBtnCaptureInstantScreenshot.addEventListener('click', async () => {
    if (!window.api || !window.api.captureInstantScreenshot) return;
    updateFooterLog('📸 Đang chụp ảnh màn hình điện thoại qua ADB...');
    const res = await window.api.captureInstantScreenshot({ deviceId: currentDeviceId });
    if (res && res.success && res.filename) {
      if (elLblLatestScreenshot) {
        elLblLatestScreenshot.textContent = res.filename;
        elLblLatestScreenshot.classList.add('active');
      }
      updateFooterLog(`📸 Đã lưu ảnh chụp: ${res.filename}`);
      playSoundCue('activate');
    }
  });
}

if (elBtnOpenScreenshotsFolder) {
  elBtnOpenScreenshotsFolder.addEventListener('click', async () => {
    if (window.api && window.api.openScreenshotsFolder) {
      await window.api.openScreenshotsFolder();
      updateFooterLog('📁 Đã mở thư mục ảnh chụp Pictures\\Pandakeyauto');
    }
  });
}

if (window.api && window.api.onScreenshotCaptured) {
  window.api.onScreenshotCaptured((data) => {
    if (data && data.filename && elLblLatestScreenshot) {
      elLblLatestScreenshot.textContent = data.filename;
      elLblLatestScreenshot.classList.add('active');
    }
  });
}

// ================= 🌐 SCREEN TRANSLATOR CONTROLS =================
const elBtnTriggerScreenTranslate = document.getElementById('btnTriggerScreenTranslate');
const elSelTranslatorLang = document.getElementById('selTranslatorLang');
const elLblTranslatorStatus = document.getElementById('lblTranslatorStatus');

if (elBtnTriggerScreenTranslate) {
  elBtnTriggerScreenTranslate.addEventListener('click', async () => {
    if (!window.api || !window.api.triggerScreenTranslate) return;
    const lang = elSelTranslatorLang ? elSelTranslatorLang.value : 'eng+chi_sim';
    if (elLblTranslatorStatus) {
      elLblTranslatorStatus.textContent = 'Đang quét dịch...';
      elLblTranslatorStatus.classList.add('active');
    }
    updateFooterLog('🌐 Đang quét chữ màn hình game và dịch thuật sang Tiếng Việt...');
    playSoundCue('activate');

    try {
      const res = await window.api.triggerScreenTranslate({ language: lang, deviceId: currentDeviceId });
      if (elLblTranslatorStatus) {
        if (res && res.success) {
          elLblTranslatorStatus.textContent = 'Đã dịch xong';
        } else {
          elLblTranslatorStatus.textContent = 'Lỗi dịch';
        }
      }
      updateFooterLog('🌐 Hoàn tất dịch màn hình game!');
    } catch (e) {
      updateFooterLog(`[Dịch màn hình] Lỗi: ${e.message}`);
      if (elLblTranslatorStatus) elLblTranslatorStatus.textContent = 'Lỗi kết nối';
    }
  });
}

if (elSelTranslatorLang) {
  elSelTranslatorLang.addEventListener('change', () => {
    if (window.api && window.api.setTranslatorConfig) {
      window.api.setTranslatorConfig({ language: elSelTranslatorLang.value });
      updateFooterLog(`🌐 Đã đổi ngôn ngữ nguồn OCR: ${elSelTranslatorLang.options[elSelTranslatorLang.selectedIndex].text}`);
    }
  });
}

// ================= 🎯 VIP FEATURES: HEADSHOT RATIO, OPACITY, CURSOR LOCK, AUTO-DETECT & HARDWARE STATS =================
const elRngWindowOpacity = document.getElementById('rngWindowOpacity');
const elLblWindowOpacity = document.getElementById('lblWindowOpacity');
if (elRngWindowOpacity) {
  elRngWindowOpacity.addEventListener('input', (e) => {
    const val = e.target.value;
    if (elLblWindowOpacity) elLblWindowOpacity.textContent = `${val}%`;
    if (window.api && window.api.setWindowOpacity) {
      window.api.setWindowOpacity(parseFloat(val) / 100);
    }
  });
}

const elRngMouseRatioY = document.getElementById('rngMouseRatioY');
const elLblMouseRatioY = document.getElementById('lblMouseRatioY');
if (elRngMouseRatioY) {
  elRngMouseRatioY.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value).toFixed(1);
    if (elLblMouseRatioY) elLblMouseRatioY.textContent = `${val}x`;
    if (window.api && window.api.setMouseRatioY) {
      window.api.setMouseRatioY(val);
    }
  });
}

const elChkCursorLock = document.getElementById('chkCursorLock');
if (elChkCursorLock) {
  elChkCursorLock.addEventListener('change', (e) => {
    if (window.api && window.api.toggleCursorLock) {
      window.api.toggleCursorLock(e.target.checked);
      updateFooterLog(e.target.checked ? '🔒 Đã khóa chuột trong khung game' : 'Đã mở khóa chuột tự do');
      playSoundCue('activate');
    }
  });
}

const elChkAutoDetectGame = document.getElementById('chkAutoDetectGame');
const elHwGameText = document.getElementById('hwGameText');

if (window.api && window.api.onGameAutoDetected) {
  window.api.onGameAutoDetected((game) => {
    if (!game) return;
    if (elHwGameText) elHwGameText.textContent = game.name || game.id;
    if (elChkAutoDetectGame && !elChkAutoDetectGame.checked) return;
    if (profilesData && Array.isArray(profilesData.profiles)) {
      const targetId = (game.id || '').toLowerCase();
      const targetName = (game.name || '').toLowerCase();
      const matched = profilesData.profiles.find(p => {
        const pid = (p.id || '').toLowerCase();
        const pname = (p.name || '').toLowerCase();
        return pid === targetId || (targetId && pname.includes(targetId)) || (targetName && pname.includes(targetName));
      });
      if (matched && (!activeProfile || activeProfile.id !== matched.id)) {
        setActiveProfile(matched.id);
        updateFooterLog(`🤖 Auto-detect: Đã chuyển sang profile ${matched.name}!`);
        playSoundCue('activate');
      }
    }
  });
}

const elHwPingText = document.getElementById('hwPingText');
const elHwBatteryText = document.getElementById('hwBatteryText');
const elHwTempText = document.getElementById('hwTempText');
const elOrbStatusLed = document.getElementById('orbStatusLed');

if (window.api && window.api.onHardwareStats) {
  window.api.onHardwareStats((stats) => {
    if (!stats) return;
    const lat = stats.latency !== undefined ? stats.latency : (stats.pingMs ? stats.pingMs.replace('ms', '') : null);
    const bat = stats.battery !== undefined ? stats.battery : stats.level;
    const temp = stats.temp !== undefined ? stats.temp : stats.tempC;
    if (elHwPingText && lat !== null && lat !== undefined) elHwPingText.textContent = `${lat}ms`;
    if (elHwBatteryText && bat !== undefined && bat !== null) elHwBatteryText.textContent = `${bat}%`;
    if (elHwTempText && temp !== undefined && temp !== null) elHwTempText.textContent = `${temp}°C`;
    
    if (elOrbStatusLed) {
      if (isControlling) {
        elOrbStatusLed.style.background = '#00ff88';
        elOrbStatusLed.style.boxShadow = '0 0 8px #00ff88';
      } else if (currentDeviceId) {
        elOrbStatusLed.style.background = '#00f2fe';
        elOrbStatusLed.style.boxShadow = '0 0 6px #00f2fe';
      } else {
        elOrbStatusLed.style.background = '#ff3366';
        elOrbStatusLed.style.boxShadow = '0 0 6px #ff3366';
      }
    }
  });
}

// ================= 📶 ADVANCED WIRELESS SUITE (TRUNG TÂM KẾT NỐI KHÔNG DÂY) =================
const elBtnQuickWifiModal = document.getElementById('btnQuickWifiModal');
const elQuickWifiEntryBar = document.getElementById('quickWifiEntryBar');
const elWifiModal = document.getElementById('wifiModal');
const elBtnCloseWifiModal = document.getElementById('btnCloseWifiModal');
const elModalTxtWifiIp = document.getElementById('modalTxtWifiIp');
const elModalTxtWifiPort = document.getElementById('modalTxtWifiPort');
const elModalBtnConnectWifi = document.getElementById('modalBtnConnectWifi');
const elModalBtnTogglePair = document.getElementById('modalBtnTogglePair');
const elModalBtnScanLan = document.getElementById('modalBtnScanLan');
const elModalPairBox = document.getElementById('modalPairBox');
const elModalTxtPairHostPort = document.getElementById('modalTxtPairHostPort');
const elModalTxtPairCode = document.getElementById('modalTxtPairCode');
const elModalTxtPairConnectPort = document.getElementById('modalTxtPairConnectPort');
const elModalBtnConfirmPair = document.getElementById('modalBtnConfirmPair');
const elModalHistoryChips = document.getElementById('modalHistoryChips');

const elBtnOneClickWifi = document.getElementById('btnOneClickWifi');
const elTxtWifiDirectIp = document.getElementById('txtWifiDirectIp');
const elTxtWifiDirectPort = document.getElementById('txtWifiDirectPort');
const elBtnConnectWifiDirect = document.getElementById('btnConnectWifiDirect');
const elBtnDisconnectWifiDirect = document.getElementById('btnDisconnectWifiDirect');
const elBtnScanWifiDevices = document.getElementById('btnScanWifiDevices');
const elBtnTogglePairBox = document.getElementById('btnTogglePairBox');
const elBtnClosePairBox = document.getElementById('btnClosePairBox');
const elPairWirelessBox = document.getElementById('pairWirelessBox');
const elTxtPairHostPort = document.getElementById('txtPairHostPort');
const elTxtPairCode = document.getElementById('txtPairCode');
const elTxtPairConnectPort = document.getElementById('txtPairConnectPort');
const elBtnConfirmPair = document.getElementById('btnConfirmPair');
const elChkAutoReconnectWifi = document.getElementById('chkAutoReconnectWifi');
const elLblClearSavedWifi = document.getElementById('lblClearSavedWifi');
const elWifiSavedChips = document.getElementById('wifiSavedChips');

async function openWifiModal() {
  if (elWifiModal) {
    elWifiModal.style.display = 'flex';
    playSoundCue('mode');

    let detectedHotspotIp = null;
    // 1. Ưu tiên kiểm tra nếu điện thoại đang bắt Wi-Fi Hotspot do PC phát ra (192.168.137.x)
    if (window.api && window.api.findHotspotDevices) {
      try {
        const hs = await window.api.findHotspotDevices();
        if (hs && hs.autoDetectedIp) {
          detectedHotspotIp = hs.autoDetectedIp;
          if (elModalTxtWifiIp) elModalTxtWifiIp.value = detectedHotspotIp;
          const hint = document.querySelector('.wifi-hint-text');
          if (hint) {
            hint.innerHTML = `🔥 <strong>Đã phát hiện điện thoại trên Hotspot:</strong> <span style="color:#00ff88;font-weight:bold;">${detectedHotspotIp}</span>`;
          }
        }
      } catch (e) {}
    }

    // 2. Nếu không phải Hotspot, tự động dò Subnet IP của PC để điền sẵn gợi ý
    if (!detectedHotspotIp && window.api && window.api.getLocalSubnet) {
      try {
        const net = await window.api.getLocalSubnet();
        if (net && net.subnet && elModalTxtWifiIp && (!elModalTxtWifiIp.value || elModalTxtWifiIp.value === '192.168.1.')) {
          elModalTxtWifiIp.value = net.subnet;
        }
      } catch (e) {}
    }

    if (elModalTxtWifiIp) {
      elModalTxtWifiIp.focus();
      const len = elModalTxtWifiIp.value.length;
      elModalTxtWifiIp.setSelectionRange(len, len);
    }
    loadSavedWifiDevices();
  }
}

function closeWifiModal() {
  if (elWifiModal) elWifiModal.style.display = 'none';
}

if (elBtnQuickWifiModal) {
  elBtnQuickWifiModal.addEventListener('click', openWifiModal);
}

let isActivatingWifi = false;

async function handleOneClickWifiAutoConfig() {
  if (isActivatingWifi) return;
  isActivatingWifi = true;

  const bar = document.getElementById('quickWifiEntryBar');
  const icon = document.getElementById('qWifiIcon');
  const text = document.getElementById('qWifiText');
  const badge = document.getElementById('qWifiBadge');

  if (bar) bar.classList.add('wifi-loading');
  if (icon) icon.textContent = '⏳';
  if (text) text.textContent = 'Đang tự cấu hình Wi-Fi cổng 5555...';
  if (badge) badge.textContent = 'Đang xử lý';

  updateFooterLog('📶 1-Click: Đang quét tìm IP điện thoại và mở cổng Wi-Fi 5555...');
  playSoundCue('activate');

  try {
    const res = await window.api.activateWirelessAdb({ deviceId: currentDeviceId });
    if (res && res.success) {
      currentDeviceId = res.targetId || `${res.ip}:5555`;
      preferredConnectionMode = 'wifi';
      localStorage.setItem('pandakey_pref_conn_mode', 'wifi');
      lockedDeviceId = currentDeviceId;
      localStorage.setItem('pandakey_locked_device_id', currentDeviceId);
      if (window.api && window.api.setConnectionLockMode) {
        await window.api.setConnectionLockMode('wifi');
      }
      if (window.api && window.api.setSelectedDevice) {
        await window.api.setSelectedDevice(currentDeviceId, { connectionMode: 'wifi' });
      }
      updateConnectionModeVisuals();
      updateFooterLog(`✅ ${res.message}`);
      playSoundCue('activate');
      await loadSavedWifiDevices();
      await updateDeviceList();
      refreshBatteryStats();
      if (window.api && window.api.pollHardwareStats) {
        window.api.pollHardwareStats();
      }
      alert(`🎉 TỰ ĐỘNG CẤU HÌNH WI-FI THÀNH CÔNG!\n\nĐịa chỉ không dây: ${currentDeviceId}\n\n👉 BÂY GIỜ BẠN CÓ THỂ RÚT CÁP USB RA!\nĐiện thoại đã được kết nối không dây sẵn sàng. Bạn có thể bấm nút BẮT ĐẦU để chơi.`);
    } else {
      updateFooterLog(`⚠️ Không tự cấu hình được: ${res?.message || 'Kiểm tra Wi-Fi'}`);
      alert(`Chưa tự cấu hình được Wi-Fi:\n\n${res?.message || 'Hãy đảm bảo máy tính và điện thoại đang kết nối chung 1 mạng Wi-Fi (hoặc điện thoại bắt Hotspot từ PC).'}\n\nBạn có thể tự nhập IP bằng nút hình sóng Wi-Fi.`);
      openWifiModal();
    }
  } catch (err) {
    updateFooterLog(`[Wi-Fi Auto] Lỗi: ${err.message}`);
    alert(`Lỗi khi cấu hình Wi-Fi: ${err.message}`);
  } finally {
    isActivatingWifi = false;
    if (bar) bar.classList.remove('wifi-loading');
    const isWifiDev = currentDeviceId && currentDeviceId.includes(':');
    updateQuickWifiEntryBarUI(isWifiDev, !currentDeviceId);
  }
}

if (elQuickWifiEntryBar) {
  elQuickWifiEntryBar.addEventListener('click', () => {
    const isUsb = currentDeviceId && !currentDeviceId.includes(':');
    if (isUsb) {
      handleOneClickWifiAutoConfig();
    } else {
      openWifiModal();
    }
  });
}

if (elBtnCloseWifiModal) {
  elBtnCloseWifiModal.addEventListener('click', closeWifiModal);
}

if (elModalBtnConnectWifi) {
  elModalBtnConnectWifi.addEventListener('click', async () => {
    const ip = (elModalTxtWifiIp?.value || '').trim();
    const port = parseInt(elModalTxtWifiPort?.value || '5555') || 5555;
    if (!ip || ip.endsWith('.')) {
      alert('Vui lòng nhập đầy đủ địa chỉ IP của điện thoại (VD: 192.168.1.15)');
      return;
    }
    updateFooterLog(`📶 Đang kết nối tới ${ip}:${port}...`);
    playSoundCue('activate');
    try {
      const res = await window.api.connectWirelessAdb({ ip, port });
      if (res && res.success) {
        currentDeviceId = res.targetId || `${ip}:${port}`;
        preferredConnectionMode = 'wifi';
        localStorage.setItem('pandakey_pref_conn_mode', 'wifi');
        lockedDeviceId = currentDeviceId;
        localStorage.setItem('pandakey_locked_device_id', currentDeviceId);
        if (window.api && window.api.setConnectionLockMode) {
          await window.api.setConnectionLockMode('wifi');
        }
        if (window.api && window.api.setSelectedDevice) {
          window.api.setSelectedDevice(currentDeviceId, { connectionMode: 'wifi' });
        }
        updateConnectionModeVisuals();
        updateFooterLog(`✅ ${res.message}`);
        closeWifiModal();
        await loadSavedWifiDevices();
        await updateDeviceList();
        if (elSelDeviceList) elSelDeviceList.value = currentDeviceId;
        refreshBatteryStats();
        if (window.api && window.api.pollHardwareStats) {
          window.api.pollHardwareStats();
        }
      } else {
        updateFooterLog(`⚠️ Lỗi kết nối: ${res?.message || 'Không thể kết nối'}`);
        alert(`Không thể kết nối không dây tới ${ip}:${port}:\n\n${res?.message || 'Vui lòng kiểm tra điện thoại đã kết nối chung Wi-Fi/Hotspot và bật gỡ lỗi không dây.'}`);
      }
    } catch (err) {
      updateFooterLog(`[Wi-Fi] Lỗi: ${err.message}`);
    }
  });
}

if (elModalTxtWifiIp) {
  elModalTxtWifiIp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (elModalBtnConnectWifi) elModalBtnConnectWifi.click();
    }
  });
}

if (elModalBtnTogglePair && elModalPairBox) {
  elModalBtnTogglePair.addEventListener('click', () => {
    elModalPairBox.style.display = elModalPairBox.style.display === 'none' ? 'flex' : 'none';
  });
}

if (elModalBtnConfirmPair) {
  elModalBtnConfirmPair.addEventListener('click', async () => {
    const hostPort = (elModalTxtPairHostPort?.value || '').trim();
    const pairCode = (elModalTxtPairCode?.value || '').trim();
    const connectPort = (elModalTxtPairConnectPort?.value || '').trim();
    if (!hostPort || !pairCode) {
      alert('Vui lòng nhập IP:Port ghép đôi và mã ghép đôi 6 số từ điện thoại!');
      return;
    }
    updateFooterLog(`🔗 Đang ghép đôi Android 11+ [${hostPort}]...`);
    playSoundCue('activate');
    try {
      const res = await window.api.pairWirelessDevice({ hostPort, pairCode, connectPort });
      if (res && res.success) {
        updateFooterLog(`✅ ${res.message}`);
        closeWifiModal();
        await loadSavedWifiDevices();
        await updateDeviceList();
      } else {
        updateFooterLog(`⚠️ Ghép đôi thất bại: ${res?.message || 'Kiểm tra lại mã'}`);
      }
    } catch (err) {
      updateFooterLog(`[Pairing] Lỗi: ${err.message}`);
    }
  });
}

if (elModalBtnScanLan) {
  elModalBtnScanLan.addEventListener('click', async () => {
    updateFooterLog('🔍 Đang quét mDNS & mạng LAN...');
    playSoundCue('activate');
    try {
      const res = await window.api.scanWirelessDevices();
      if (res && res.success && res.devices && res.devices.length > 0) {
        updateFooterLog(`🔍 Tìm thấy ${res.devices.length} thiết bị không dây!`);
        renderSavedWifiChips(res.devices);
      } else {
        updateFooterLog('🔍 Không tìm thấy thiết bị mới. Hãy chắc chắn điện thoại đang bật Wi-Fi.');
      }
    } catch (err) {
      updateFooterLog(`[Scan] Lỗi: ${err.message}`);
    }
  });
}

if (elBtnOneClickWifi) {
  elBtnOneClickWifi.addEventListener('click', handleOneClickWifiAutoConfig);
}

if (elBtnConnectWifiDirect) {
  elBtnConnectWifiDirect.addEventListener('click', async () => {
    const ip = (elTxtWifiDirectIp?.value || '').trim();
    const port = parseInt(elTxtWifiDirectPort?.value || '5555') || 5555;
    if (!ip) {
      alert('Vui lòng nhập địa chỉ IP của điện thoại (VD: 192.168.1.15)');
      return;
    }
    updateFooterLog(`📶 Đang kết nối tới ${ip}:${port}...`);
    playSoundCue('activate');
    try {
      const res = await window.api.connectWirelessAdb({ ip, port, deviceId: currentDeviceId });
      if (res && res.success) {
        currentDeviceId = res.targetId || `${ip}:${port}`;
        preferredConnectionMode = 'wifi';
        localStorage.setItem('pandakey_pref_conn_mode', 'wifi');
        lockedDeviceId = currentDeviceId;
        localStorage.setItem('pandakey_locked_device_id', currentDeviceId);
        if (window.api && window.api.setConnectionLockMode) {
          await window.api.setConnectionLockMode('wifi');
        }
        if (window.api && window.api.setSelectedDevice) {
          window.api.setSelectedDevice(currentDeviceId, { connectionMode: 'wifi' });
        }
        updateConnectionModeVisuals();
        updateFooterLog(`✅ ${res.message}`);
        await loadSavedWifiDevices();
        await updateDeviceList();
      } else {
        updateFooterLog(`⚠️ Lỗi kết nối: ${res?.message || 'Không thể kết nối'}`);
      }
    } catch (err) {
      updateFooterLog(`[Wi-Fi] Lỗi: ${err.message}`);
    }
  });
}

if (elBtnDisconnectWifiDirect) {
  elBtnDisconnectWifiDirect.addEventListener('click', async () => {
    const ip = (elTxtWifiDirectIp?.value || '').trim();
    const port = elTxtWifiDirectPort?.value || '5555';
    const target = ip ? `${ip}:${port}` : currentDeviceId;
    if (!target) return;
    try {
      const res = await window.api.disconnectWifi({ target });
      updateFooterLog(res?.message || `Đã ngắt kết nối ${target}`);
      await updateDeviceList();
    } catch (err) {
      updateFooterLog(`[Wi-Fi] Lỗi ngắt kết nối: ${err.message}`);
    }
  });
}

if (elBtnTogglePairBox && elPairWirelessBox) {
  elBtnTogglePairBox.addEventListener('click', () => {
    elPairWirelessBox.style.display = elPairWirelessBox.style.display === 'none' ? 'flex' : 'none';
  });
}
if (elBtnClosePairBox && elPairWirelessBox) {
  elBtnClosePairBox.addEventListener('click', () => {
    elPairWirelessBox.style.display = 'none';
  });
}

if (elBtnConfirmPair) {
  elBtnConfirmPair.addEventListener('click', async () => {
    const hostPort = (elTxtPairHostPort?.value || '').trim();
    const pairCode = (elTxtPairCode?.value || '').trim();
    const connectPort = (elTxtPairConnectPort?.value || '').trim();
    if (!hostPort || !pairCode) {
      alert('Vui lòng nhập IP:Port ghép đôi và mã ghép đôi 6 số từ điện thoại!');
      return;
    }
    updateFooterLog(`🔗 Đang ghép đôi thiết bị Android 11+ [${hostPort}]...`);
    playSoundCue('activate');
    try {
      const res = await window.api.pairWirelessDevice({ hostPort, pairCode, connectPort });
      if (res && res.success) {
        updateFooterLog(`✅ ${res.message}`);
        if (elPairWirelessBox) elPairWirelessBox.style.display = 'none';
        await loadSavedWifiDevices();
        await updateDeviceList();
      } else {
        updateFooterLog(`⚠️ Ghép đôi thất bại: ${res?.message || 'Kiểm tra lại mã'}`);
      }
    } catch (err) {
      updateFooterLog(`[Pairing] Lỗi: ${err.message}`);
    }
  });
}

if (elBtnScanWifiDevices) {
  elBtnScanWifiDevices.addEventListener('click', async () => {
    updateFooterLog('🔍 Đang quét mDNS & mạng LAN tìm điện thoại Android...');
    playSoundCue('activate');
    try {
      const res = await window.api.scanWirelessDevices();
      if (res && res.success && res.devices && res.devices.length > 0) {
        updateFooterLog(`🔍 Tìm thấy ${res.devices.length} thiết bị không dây!`);
        renderSavedWifiChips(res.devices);
      } else {
        updateFooterLog('🔍 Không tìm thấy thiết bị mDNS mới. Hãy chắc chắn điện thoại đang bật Wi-Fi.');
      }
    } catch (err) {
      updateFooterLog(`[Scan] Lỗi: ${err.message}`);
    }
  });
}

async function loadSavedWifiDevices() {
  if (!window.api || !window.api.getSavedWifiDevices) return;
  try {
    const cfg = await window.api.getSavedWifiDevices();
    if (elChkAutoReconnectWifi && typeof cfg.autoReconnect === 'boolean') {
      elChkAutoReconnectWifi.checked = cfg.autoReconnect;
    }
    renderSavedWifiChips(cfg.savedDevices || []);
  } catch (e) {}
}

function renderSavedWifiChips(devices) {
  if (elWifiSavedChips) elWifiSavedChips.innerHTML = '';
  if (elModalHistoryChips) elModalHistoryChips.innerHTML = '';

  if (!devices || devices.length === 0) {
    if (elWifiSavedChips) elWifiSavedChips.innerHTML = '<span class="wifi-chip-empty">Chưa có thiết bị nào được lưu</span>';
    if (elModalHistoryChips) elModalHistoryChips.innerHTML = '<span class="wifi-chip-empty">Chưa có lịch sử</span>';
    return;
  }
  devices.forEach(dev => {
    // 1. Chip trong Drawer
    if (elWifiSavedChips) {
      const chip = document.createElement('div');
      chip.className = 'wifi-device-chip';
      chip.title = `Bấm để kết nối nhanh tới ${dev.fullTarget || dev.ip}`;
      chip.innerHTML = `<span>📶 ${dev.ip}:${dev.port || 5555}</span><span class="chip-del" title="Xóa">✕</span>`;

      chip.querySelector('span:first-child').addEventListener('click', async () => {
        if (elTxtWifiDirectIp) elTxtWifiDirectIp.value = dev.ip;
        if (elTxtWifiDirectPort) elTxtWifiDirectPort.value = dev.port || 5555;
        updateFooterLog(`📶 Đang kết nối nhanh tới ${dev.ip}:${dev.port || 5555}...`);
        playSoundCue('activate');
        try {
          const res = await window.api.connectWirelessAdb({ ip: dev.ip, port: dev.port || 5555 });
          if (res && res.success) {
            currentDeviceId = res.targetId || `${dev.ip}:${dev.port || 5555}`;
            preferredConnectionMode = 'wifi';
            localStorage.setItem('pandakey_pref_conn_mode', 'wifi');
            lockedDeviceId = currentDeviceId;
            localStorage.setItem('pandakey_locked_device_id', currentDeviceId);
            if (window.api && window.api.setConnectionLockMode) {
              await window.api.setConnectionLockMode('wifi');
            }
            if (window.api && window.api.setSelectedDevice) {
              window.api.setSelectedDevice(currentDeviceId, { connectionMode: 'wifi' });
            }
            updateConnectionModeVisuals();
            updateFooterLog(`✅ Đã kết nối tới ${dev.ip}:${dev.port || 5555}`);
            await updateDeviceList();
            if (elSelDeviceList) elSelDeviceList.value = currentDeviceId;
            refreshBatteryStats();
            if (window.api && window.api.pollHardwareStats) {
              window.api.pollHardwareStats();
            }
          } else {
            updateFooterLog(`⚠️ Không thể kết nối tới ${dev.ip}: ${res?.message}`);
          }
        } catch (err) {
          updateFooterLog(`[Wi-Fi] Lỗi: ${err.message}`);
        }
      });

      chip.querySelector('.chip-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const cfg = await window.api.getSavedWifiDevices();
          cfg.savedDevices = (cfg.savedDevices || []).filter(x => !(x.ip === dev.ip && x.port === dev.port));
          await window.api.saveWifiDevicesConfig({ savedDevices: cfg.savedDevices });
          renderSavedWifiChips(cfg.savedDevices);
          updateFooterLog(`Đã xóa thiết bị ${dev.ip} khỏi danh sách lưu`);
        } catch (err) {}
      });

      elWifiSavedChips.appendChild(chip);
    }

    // 2. Chip trong Popup Modal
    if (elModalHistoryChips) {
      const modalChip = document.createElement('div');
      modalChip.className = 'wifi-device-chip';
      modalChip.title = `Click để kết nối tới ${dev.ip}`;
      modalChip.innerHTML = `<span>📶 ${dev.ip}:${dev.port || 5555}</span>`;
      modalChip.addEventListener('click', () => {
        if (elModalTxtWifiIp) elModalTxtWifiIp.value = dev.ip;
        if (elModalTxtWifiPort) elModalTxtWifiPort.value = dev.port || 5555;
        if (elModalBtnConnectWifi) elModalBtnConnectWifi.click();
      });
      elModalHistoryChips.appendChild(modalChip);
    }
  });
}

if (elChkAutoReconnectWifi) {
  elChkAutoReconnectWifi.addEventListener('change', async (e) => {
    if (window.api && window.api.saveWifiDevicesConfig) {
      await window.api.saveWifiDevicesConfig({ autoReconnect: e.target.checked });
      updateFooterLog(e.target.checked ? '🔄 Đã bật tự động kết nối lại Wi-Fi khi mở app' : 'Đã tắt tự kết nối Wi-Fi');
    }
  });
}

if (elLblClearSavedWifi) {
  elLblClearSavedWifi.addEventListener('click', async () => {
    if (confirm('Xóa danh sách thiết bị Wi-Fi đã lưu?')) {
      if (window.api && window.api.saveWifiDevicesConfig) {
        await window.api.saveWifiDevicesConfig({ savedDevices: [] });
        await loadSavedWifiDevices();
        updateFooterLog('Đã xóa danh sách thiết bị Wi-Fi');
      }
    }
  });
}

async function checkWifiDiagnostics(devId) {
  if (!window.api || !window.api.getWifiQuality) return;
  try {
    const q = await window.api.getWifiQuality(devId);
    const diag = document.getElementById('wifiDiagnosticsBar');
    const lblQual = document.getElementById('lblWifiSignalQuality');
    const lblPing = document.getElementById('lblWifiLatencyPing');
    if (diag && q && q.success) {
      diag.style.display = 'flex';
      if (lblQual) lblQual.textContent = `📶 ${q.is5GHz ? '5GHz' : '2.4GHz'} • ${q.linkSpeed} Mbps (${q.rssi} dBm)`;
      if (lblPing) lblPing.textContent = `${q.qualityText} • Tín hiệu ${q.rssi > -65 ? 'Rất Mạnh' : 'Khá'}`;
    }
  } catch (e) {}
}

// ================= KHỞI CHẠY LẦN ĐẦU =================
window.addEventListener('DOMContentLoaded', () => {
  loadProfiles();
  initSwitchKey();
  initGithubConfig();
  updateModeCardVisuals();
  updateAudioVisuals();
  updateConnectionModeVisuals();
  if (window.api && window.api.setConnectionLockMode) {
    window.api.setConnectionLockMode(preferredConnectionMode);
  }
  updateDeviceList();
  loadSavedWifiDevices();
  refreshBatteryStats();
  if (window.api && window.api.pollHardwareStats) {
    window.api.pollHardwareStats();
  }
  setInterval(() => {
    if (!isSessionActive) {
      updateDeviceList();
    }
  }, 5000);
  setInterval(refreshBatteryStats, 8000);
});

// ================= 🚀 ULTRA GAMING UI UPDATE LOGIC =================

// 1. MOUSE MODE INDICATOR HUD & AUTO-DIM
const elMouseStatusIndicator = document.getElementById('mouseStatusIndicator');
const elMouseHudText = document.getElementById('mouseHudText');
let currentMouseMode = 'pc';
let isAutoDimEnabled = localStorage.getItem('pandakey_auto_dim') !== 'false';
const elChkAutoDim = document.getElementById('chkAutoDim');
if (elChkAutoDim) {
  elChkAutoDim.checked = isAutoDimEnabled;
  elChkAutoDim.addEventListener('change', () => {
    isAutoDimEnabled = elChkAutoDim.checked;
    localStorage.setItem('pandakey_auto_dim', isAutoDimEnabled ? 'true' : 'false');
    if (!isAutoDimEnabled) {
      document.body.classList.remove('stealth-dimmed');
    } else if (currentMouseMode === 'phone') {
      document.body.classList.add('stealth-dimmed');
    }
  });
}

function updateMouseModeUI(mode) {
  currentMouseMode = mode;
  if (!elMouseStatusIndicator) return;
  if (mode === 'phone') {
    elMouseStatusIndicator.classList.remove('pc-mode');
    elMouseStatusIndicator.classList.add('phone-mode');
    if (elMouseHudText) elMouseHudText.textContent = 'GAME';
    if (isAutoDimEnabled) {
      document.body.classList.add('stealth-dimmed');
    }
  } else {
    elMouseStatusIndicator.classList.remove('phone-mode');
    elMouseStatusIndicator.classList.add('pc-mode');
    if (elMouseHudText) elMouseHudText.textContent = 'PC';
    document.body.classList.remove('stealth-dimmed');
  }
}

if (elMouseStatusIndicator) {
  elMouseStatusIndicator.addEventListener('click', () => {
    if (window.api && window.api.switchMouseFocus) {
      window.api.switchMouseFocus();
    }
  });
}

if (window.api && window.api.onMouseModeChanged) {
  window.api.onMouseModeChanged((data) => {
    if (data && data.mode) {
      updateMouseModeUI(data.mode);
    }
  });
}

// 2. MINI DOCK MODE TOGGLE
const elBtnToggleMiniDock = document.getElementById('btnToggleMiniDock');
let isMiniDockActive = false;
if (elBtnToggleMiniDock) {
  elBtnToggleMiniDock.addEventListener('click', async () => {
    isMiniDockActive = !isMiniDockActive;
    if (isMiniDockActive) {
      document.body.classList.add('mini-dock-mode');
      if (window.api && window.api.toggleWindowSize) {
        await window.api.toggleWindowSize({ w: 340, h: 36 });
      }
      elBtnToggleMiniDock.textContent = '⊞';
      elBtnToggleMiniDock.title = 'Mở rộng Dashboard';
    } else {
      document.body.classList.remove('mini-dock-mode');
      if (window.api && window.api.toggleWindowSize) {
        await window.api.toggleWindowSize({ w: 340, h: 450 });
      }
      elBtnToggleMiniDock.textContent = '⊟';
      elBtnToggleMiniDock.title = 'Thu nhỏ thành thanh Mini Dock';
    }
  });
}

// 3. GAMING THEMES SWITCHER
const themeChips = document.querySelectorAll('.theme-chip');
function applyTheme(themeName) {
  document.body.setAttribute('data-theme', themeName);
  localStorage.setItem('pandakey_theme', themeName);
  themeChips.forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-theme') === themeName);
  });
}

const savedTheme = localStorage.getItem('pandakey_theme') || 'cyan';
applyTheme(savedTheme);

themeChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const t = chip.getAttribute('data-theme');
    applyTheme(t);
    playSoundCue('mode');
  });
});

// 4. RADIAL QUICK ACTION WHEEL
const elRadialBackdrop = document.getElementById('radialMenuBackdrop');
const elBtnTriggerRadial = document.getElementById('btnTriggerRadial');

function toggleRadialMenu(show) {
  if (!elRadialBackdrop) return;
  const target = (typeof show === 'boolean') ? show : (elRadialBackdrop.style.display === 'none');
  elRadialBackdrop.style.display = target ? 'flex' : 'none';
  if (target) playSoundCue('activate');
}

if (elBtnTriggerRadial) {
  elBtnTriggerRadial.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleRadialMenu();
  });
}

if (elRadialBackdrop) {
  elRadialBackdrop.addEventListener('click', (e) => {
    if (e.target === elRadialBackdrop) {
      toggleRadialMenu(false);
    }
  });

  const radialSlices = elRadialBackdrop.querySelectorAll('.radial-slice');
  radialSlices.forEach(slice => {
    slice.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = slice.getAttribute('data-action');
      toggleRadialMenu(false);
      playSoundCue('activate');

      if (action === 'recoil') {
        const btn = document.getElementById('btnToggleRecoil');
        if (btn) btn.click();
      } else if (action === 'sniper') {
        const btn = document.getElementById('btnToggleQuickSniper');
        if (btn) btn.click();
      } else if (action === 'screenshot') {
        const btn = document.getElementById('btnCaptureInstantScreenshot');
        if (btn) btn.click();
      } else if (action === 'translate') {
        const btn = document.getElementById('btnTriggerScreenTranslate');
        if (btn) btn.click();
      } else if (action === 'keymap') {
        const btn = document.getElementById('btnToggleKeymapHud');
        if (btn) btn.click();
      } else if (action === 'cooler') {
        const btn = document.getElementById('btnToggleCooler');
        if (btn) btn.click();
      }
    });
  });
}
