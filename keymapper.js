const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Default Keymap Layouts for popular games
 * Coordinates are normalized (percentages 0.0 to 1.0)
 */
const DEFAULT_KEYMAPS = {
  freefire: {
    gameId: 'freefire',
    name: 'Free Fire',
    resolution: { width: 1920, height: 1080 },
    joystick: {
      key: 'WASD',
      centerX: 0.18,
      centerY: 0.74,
      radius: 0.07,
      label: 'Di Chuyển'
    },
    fire: {
      key: 'LClick',
      x: 0.86,
      y: 0.72,
      label: 'Bắn'
    },
    scope: {
      key: 'RClick',
      x: 0.88,
      y: 0.48,
      label: 'Ngắm'
    },
    keys: [
      { key: 'Space', x: 0.94, y: 0.85, label: 'Nhảy' },
      { key: 'C', x: 0.86, y: 0.88, label: 'Ngồi' },
      { key: 'Z', x: 0.78, y: 0.88, label: 'Nằm' },
      { key: 'R', x: 0.75, y: 0.28, label: 'Nạp đạn' },
      { key: '1', x: 0.70, y: 0.12, label: 'Súng 1' },
      { key: '2', x: 0.78, y: 0.12, label: 'Súng 2' },
      { key: '3', x: 0.86, y: 0.12, label: 'Vũ khí 3' },
      { key: 'F', x: 0.68, y: 0.38, label: 'Nhặt đồ' },
      { key: 'G', x: 0.68, y: 0.46, label: 'Lựu đạn' },
      { key: 'E', x: 0.85, y: 0.35, label: 'Kỹ năng' },
      { key: 'Tab', x: 0.10, y: 0.45, label: 'Balo' },
      { key: 'Shift', x: 0.28, y: 0.62, label: 'Chạy nhanh' },
      { key: '4', x: 0.12, y: 0.88, label: 'Túi cứu thương' }
    ]
  },
  deltaforce: {
    gameId: 'deltaforce',
    name: 'Delta Force',
    resolution: { width: 1920, height: 1080 },
    joystick: {
      key: 'WASD',
      centerX: 0.16,
      centerY: 0.72,
      radius: 0.08,
      label: 'Di Chuyển'
    },
    fire: {
      key: 'LClick',
      x: 0.84,
      y: 0.68,
      label: 'Bắn'
    },
    scope: {
      key: 'RClick',
      x: 0.89,
      y: 0.52,
      label: 'Ngắm'
    },
    keys: [
      { key: 'Space', x: 0.93, y: 0.82, label: 'Nhảy' },
      { key: 'C', x: 0.84, y: 0.85, label: 'Ngồi' },
      { key: 'Z', x: 0.76, y: 0.86, label: 'Nằm' },
      { key: 'R', x: 0.78, y: 0.30, label: 'Nạp đạn' },
      { key: '1', x: 0.68, y: 0.14, label: 'Súng chính' },
      { key: '2', x: 0.76, y: 0.14, label: 'Súng phụ' },
      { key: '3', x: 0.84, y: 0.14, label: 'Dao / Cận chiến' },
      { key: 'F', x: 0.72, y: 0.42, label: 'Tương tác / Nhặt' },
      { key: 'G', x: 0.64, y: 0.65, label: 'Chiến thuật' },
      { key: 'E', x: 0.88, y: 0.38, label: 'Nghiêng phải' },
      { key: 'Q', x: 0.82, y: 0.38, label: 'Nghiêng trái' },
      { key: 'Shift', x: 0.25, y: 0.58, label: 'Chạy nhanh' },
      { key: 'Tab', x: 0.08, y: 0.50, label: 'Bản đồ / Balo' }
    ]
  },
  pubg: {
    gameId: 'pubg',
    name: 'PUBG Mobile / COD',
    resolution: { width: 1920, height: 1080 },
    joystick: {
      key: 'WASD',
      centerX: 0.17,
      centerY: 0.73,
      radius: 0.08,
      label: 'Di Chuyển'
    },
    fire: {
      key: 'LClick',
      x: 0.85,
      y: 0.70,
      label: 'Bắn'
    },
    scope: {
      key: 'RClick',
      x: 0.88,
      y: 0.50,
      label: 'Mở Scope'
    },
    keys: [
      { key: 'Space', x: 0.94, y: 0.84, label: 'Nhảy' },
      { key: 'C', x: 0.85, y: 0.86, label: 'Ngồi' },
      { key: 'Z', x: 0.77, y: 0.86, label: 'Nằm' },
      { key: 'R', x: 0.76, y: 0.30, label: 'Nạp đạn' },
      { key: '1', x: 0.70, y: 0.14, label: 'Súng 1' },
      { key: '2', x: 0.78, y: 0.14, label: 'Súng 2' },
      { key: '3', x: 0.86, y: 0.14, label: 'Súng 3' },
      { key: 'F', x: 0.70, y: 0.40, label: 'Nhặt đồ 1' },
      { key: 'G', x: 0.70, y: 0.48, label: 'Nhặt đồ 2' },
      { key: 'H', x: 0.70, y: 0.56, label: 'Nhặt đồ 3' },
      { key: 'Q', x: 0.80, y: 0.38, label: 'Nghiêng trái' },
      { key: 'E', x: 0.88, y: 0.38, label: 'Nghiêng phải' },
      { key: 'Shift', x: 0.26, y: 0.60, label: 'Chạy nhanh' },
      { key: 'Tab', x: 0.09, y: 0.48, label: 'Balo' },
      { key: 'M', x: 0.92, y: 0.12, label: 'Bản đồ' }
    ]
  }
};

class Keymapper {
  constructor(appDataDir, adbPath) {
    this.appDataDir = appDataDir || path.join(__dirname, '.app_data');
    this.adbPath = adbPath || 'adb';
    this.configPath = path.join(this.appDataDir, 'keymaps.json');
    this.keymaps = {};
    this.activeGameId = 'freefire';
    this.deviceResolution = { width: 1080, height: 2400 }; // Default portrait or landscape
    this.init();
  }

  init() {
    if (!fs.existsSync(this.appDataDir)) {
      try { fs.mkdirSync(this.appDataDir, { recursive: true }); } catch (e) {}
    }

    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        this.keymaps = JSON.parse(raw);
      } catch (e) {
        console.error('Lỗi khi đọc keymaps.json, khởi tạo mặc định:', e);
        this.keymaps = JSON.parse(JSON.stringify(DEFAULT_KEYMAPS));
        this.save();
      }
    } else {
      this.keymaps = JSON.parse(JSON.stringify(DEFAULT_KEYMAPS));
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.keymaps, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('Lỗi lưu keymaps.json:', e);
      return false;
    }
  }

  getKeymap(gameId) {
    const id = gameId || this.activeGameId;
    if (!this.keymaps[id]) {
      // Fallback
      return DEFAULT_KEYMAPS[id] || DEFAULT_KEYMAPS['freefire'];
    }
    return this.keymaps[id];
  }

  saveKeymap(gameId, layout) {
    const id = gameId || this.activeGameId;
    this.keymaps[id] = layout;
    return this.save();
  }

  resetKeymap(gameId) {
    const id = gameId || this.activeGameId;
    if (DEFAULT_KEYMAPS[id]) {
      this.keymaps[id] = JSON.parse(JSON.stringify(DEFAULT_KEYMAPS[id]));
    } else {
      this.keymaps[id] = JSON.parse(JSON.stringify(DEFAULT_KEYMAPS['freefire']));
      this.keymaps[id].gameId = id;
    }
    return this.save();
  }

  /**
   * Set the actual physical or mirrored screen resolution of the target phone
   */
  setScreenResolution(width, height) {
    if (width > 0 && height > 0) {
      this.deviceResolution = { width, height };
    }
  }

  /**
   * Convert normalized (0.0 to 1.0) coordinates to screen pixels
   */
  toScreenPixels(normX, normY) {
    // For games in landscape, width is usually the larger dimension
    const w = Math.max(this.deviceResolution.width, this.deviceResolution.height);
    const h = Math.min(this.deviceResolution.width, this.deviceResolution.height);
    return {
      x: Math.round(normX * w),
      y: Math.round(normY * h)
    };
  }

  /**
   * Inject a rapid touch tap into Android via ADB shell
   */
  injectTap(normX, normY, deviceId = null) {
    const { x, y } = this.toScreenPixels(normX, normY);
    const target = deviceId ? `-s "${deviceId}"` : '';
    const cmd = `"${this.adbPath}" ${target} shell "input tap ${x} ${y}"`;
    exec(cmd, () => {});
  }

  /**
   * Inject a swipe / joystick movement into Android via ADB shell
   */
  injectSwipe(startX, startY, endX, endY, durationMs = 80, deviceId = null) {
    const p1 = this.toScreenPixels(startX, startY);
    const p2 = this.toScreenPixels(endX, endY);
    const target = deviceId ? `-s "${deviceId}"` : '';
    const cmd = `"${this.adbPath}" ${target} shell "input swipe ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${durationMs}"`;
    exec(cmd, () => {});
  }

  /**
   * Handle Key Press from PC and route to the corresponding touch target
   */
  handleKeyPress(key, gameId = null, deviceId = null) {
    const keymap = this.getKeymap(gameId);
    if (!keymap) return false;

    // Check fire button
    if (key === 'LClick' && keymap.fire) {
      this.injectTap(keymap.fire.x, keymap.fire.y, deviceId);
      return true;
    }

    // Check scope button
    if (key === 'RClick' && keymap.scope) {
      this.injectTap(keymap.scope.x, keymap.scope.y, deviceId);
      return true;
    }

    // Check normal keys
    if (keymap.keys && Array.isArray(keymap.keys)) {
      const match = keymap.keys.find(k => k.key.toUpperCase() === key.toUpperCase());
      if (match) {
        this.injectTap(match.x, match.y, deviceId);
        return true;
      }
    }

    // Check Joystick directions
    if (keymap.joystick) {
      const j = keymap.joystick;
      const r = j.radius || 0.07;
      let targetX = j.centerX;
      let targetY = j.centerY;

      switch (key.toUpperCase()) {
        case 'W': targetY -= r; break;
        case 'S': targetY += r; break;
        case 'A': targetX -= r; break;
        case 'D': targetX += r; break;
        default: return false;
      }
      this.injectSwipe(j.centerX, j.centerY, targetX, targetY, 100, deviceId);
      return true;
    }

    return false;
  }
}

module.exports = Keymapper;
