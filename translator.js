const { exec, spawn } = require('child_process');
const { createWorker } = require('tesseract.js');
const path = require('path');
const fs = require('fs');

class ScreenTranslator {
  constructor(adbPath) {
    this.adbPath = adbPath;
    this.worker = null;
    this.currentLangs = 'eng+chi_sim';
    this.isInitializing = false;
    this.isTranslating = false;
  }

  async getWorker(languages = 'eng+chi_sim') {
    if (this.worker && this.currentLangs === languages) {
      return this.worker;
    }

    if (this.isInitializing) {
      // Đợi worker khởi tạo xong nếu đang bận
      while (this.isInitializing) {
        await new Promise(r => setTimeout(r, 100));
      }
      if (this.worker && this.currentLangs === languages) {
        return this.worker;
      }
    }

    this.isInitializing = true;
    try {
      if (this.worker) {
        try { await this.worker.terminate(); } catch (e) {}
        this.worker = null;
      }
      this.worker = await createWorker(languages);
      this.currentLangs = languages;
    } catch (e) {
      console.error('Lỗi khi tạo Tesseract Worker:', e);
      throw e;
    } finally {
      this.isInitializing = false;
    }
    return this.worker;
  }

  captureScreen(deviceId) {
    return new Promise((resolve, reject) => {
      const target = deviceId ? ['-s', deviceId] : [];
      const args = [...target, 'exec-out', 'screencap', '-p'];

      const proc = spawn(this.adbPath, args, { windowsHide: true });
      const chunks = [];

      proc.stdout.on('data', chunk => chunks.push(chunk));
      proc.stderr.on('data', err => console.warn('screencap stderr:', err.toString()));

      proc.on('close', code => {
        if (code === 0 && chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`Chụp màn hình thất bại (mã thoát: ${code})`));
        }
      });

      proc.on('error', err => reject(err));
    });
  }

  async translateTextGoogle(text, targetLang = 'vi') {
    if (!text || !text.trim()) return '';
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text.trim())}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);
      const data = await res.json();
      if (data && data[0] && Array.isArray(data[0])) {
        return data[0].map(item => item[0]).join('');
      }
      return text;
    } catch (e) {
      console.warn('Lỗi gọi API Google Translate:', e);
      return text;
    }
  }

  async processScreenTranslation(deviceId, options = {}) {
    if (this.isTranslating) {
      return { success: false, message: 'Hệ thống đang dịch bản trước, xin vui lòng đợi...' };
    }

    this.isTranslating = true;
    const t0 = Date.now();

    try {
      // 1. Chụp ảnh màn hình điện thoại
      const imgBuffer = await this.captureScreen(deviceId);
      if (!imgBuffer || imgBuffer.length < 500) {
        throw new Error('Ảnh chụp màn hình rỗng hoặc thiết bị chưa sẵn sàng.');
      }

      // 2. Chạy OCR nhận diện chữ
      const lang = options.language || 'eng+chi_sim';
      const worker = await this.getWorker(lang);
      const ret = await worker.recognize(imgBuffer);

      const rawText = (ret.data && ret.data.text) ? ret.data.text : '';
      const lines = rawText.split('\n')
        .map(l => l.trim())
        .filter(l => l.length >= 2); // Bỏ các ký tự rác 1 ký tự

      if (lines.length === 0) {
        return {
          success: true,
          isEmpty: true,
          items: [],
          message: 'Không phát hiện thấy văn bản hoặc chữ trên màn hình hiện tại.',
          elapsedMs: Date.now() - t0
        };
      }

      // 3. Gom nhóm và dịch song song từng đoạn
      // Gom tối đa 8 dòng hoặc dịch các khối có ý nghĩa
      const chunks = [];
      let temp = '';
      for (const line of lines) {
        if ((temp + '\n' + line).length > 200) {
          if (temp) chunks.push(temp);
          temp = line;
        } else {
          temp = temp ? (temp + '\n' + line) : line;
        }
      }
      if (temp) chunks.push(temp);

      const translatedItems = [];
      for (const chunk of chunks) {
        const trans = await this.translateTextGoogle(chunk, 'vi');
        translatedItems.push({
          original: chunk,
          translated: trans
        });
      }

      const fullOriginal = lines.join('\n');
      const fullTranslated = translatedItems.map(i => i.translated).join('\n\n');

      return {
        success: true,
        isEmpty: false,
        fullOriginal,
        fullTranslated,
        items: translatedItems,
        elapsedMs: Date.now() - t0,
        timestamp: new Date().toLocaleTimeString('vi-VN')
      };
    } catch (e) {
      console.error('Lỗi trong quá trình dịch màn hình:', e);
      return {
        success: false,
        message: e.message || 'Lỗi xử lý OCR hoặc dịch thuật.'
      };
    } finally {
      this.isTranslating = false;
    }
  }
}

module.exports = ScreenTranslator;
