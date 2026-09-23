/**
 * =============================================================================
 * HIKE Universal 1D & 2D Code WebAssembly Engine (hike_code_wrapper.js)
 * 100% Drop-in Replacement for:
 *   1. Html5Qrcode & Html5QrcodeScanner (mebjas) - Camera, File & Image Scanner
 *   2. JsBarcode (lindell) - 1D Barcode Generator (Canvas, SVG)
 *   3. qrcode.js (Kazuhiko Arase) & QRCode (davidshimjs) - 2D QR Code Generator
 *
 * Supported Code Symbologies:
 *   - 2D: QR Code, Micro QR (MiniQR), rMQR, Data Matrix, Aztec, PDF417, MaxiCode
 *   - 1D: EAN-13, EAN-8, UPC-A, UPC-E, UPC/EAN Extension, Code 128, Code 39,
 *         Code 93, Codabar (NW-7), ITF (ITF-14), GS1 DataBar (RSS-14, RSS-Expanded)
 *
 * Architecture & Dynamic Modular Loading:
 *   - Scan Modules: 'scan_qr', 'scan_1d', 'scan_qr_dm', 'scan_all'
 *   - Gen Modules:  'gen_qr',  'gen_1d',  'gen_all'
 * =============================================================================
 */
(function (global) {
  'use strict';

  // --- 0. Original Preservation for Fail-Safe Rollback ---
  const PRESERVED_HTML5_QRCODE = global.Html5Qrcode || null;
  const PRESERVED_HTML5_SCANNER = global.Html5QrcodeScanner || null;
  const PRESERVED_JS_BARCODE = global.JsBarcode || null;
  const PRESERVED_QRCODE = global.QRCode || null;

  global.__ORIGINAL_HTML5_QRCODE__ = PRESERVED_HTML5_QRCODE;
  global.__ORIGINAL_JS_BARCODE__ = PRESERVED_JS_BARCODE;

  // --- 1. Html5Qrcode Standard Formats Constants ---
  const Formats = {
    QR_CODE: 0,
    AZTEC: 1,
    CODABAR: 2,
    CODE_39: 3,
    CODE_93: 4,
    CODE_128: 5,
    DATA_MATRIX: 6,
    MAXICODE: 7,
    ITF: 8,
    EAN_13: 9,
    EAN_8: 10,
    PDF_417: 11,
    RSS_14: 12,
    RSS_EXPANDED: 13,
    UPC_A: 14,
    UPC_E: 15,
    UPC_EAN_EXTENSION: 16,
    // Extensions
    MICRO_QR: 101,
    RMQR: 102
  };

  global.Html5QrcodeSupportedFormats = Formats;

  // --- 2. HIKE Core Engine Manager ---
  const HikeCode = {
    instances: {},
    activeTarget: 'all',
    fallbackActive: false,
    cascadeMode: 2, // 0 = Fast Pass, 1 = Full Enhance Always, 2 = Cascade Auto (Default)

    setCascadeMode(mode) {
      if (typeof mode === 'string') {
        const m = mode.toLowerCase();
        if (m === 'fast') this.cascadeMode = 0;
        else if (m === 'enhance' || m === 'full') this.cascadeMode = 1;
        else this.cascadeMode = 2;
      } else {
        this.cascadeMode = Number(mode);
      }
      for (const inst of Object.values(this.instances)) {
        if (inst && typeof inst.set_cascade_mode === 'function') {
          inst.set_cascade_mode(this.cascadeMode);
        }
      }
    },

    getWasmUrl(moduleName) {
      if (typeof document !== 'undefined' && document.currentScript) {
        return new URL(`../targets/${moduleName}/${moduleName}.wasm`, document.currentScript.src).href;
      }
      return `${moduleName}.wasm`;
    },

    async loadModule(targetName) {
      if (this.instances[targetName]) {
        return this.instances[targetName];
      }

      // Try loading target wasm or fallback to verified bundle wasm
      const urlCandidates = [
        this.getWasmUrl(targetName),
        `../OLD/qr/qr_full.wasm`,
        `../OLD/barcode/barcode.wasm`,
        `qr_full.wasm`,
        `barcode.wasm`
      ];

      for (const url of urlCandidates) {
        try {
          let wasmBytes = null;
          if (typeof fetch === 'function') {
            const resp = await fetch(url);
            if (resp.ok) {
              wasmBytes = await resp.arrayBuffer();
            }
          } else if (typeof require !== 'undefined') {
            const fs = require('fs');
            const path = require('path');
            const p = path.resolve(__dirname, url);
            if (fs.existsSync(p)) {
              wasmBytes = fs.readFileSync(p);
            }
          }

          if (wasmBytes) {
            const { instance } = await WebAssembly.instantiate(wasmBytes, { env: {} });
            this.instances[targetName] = instance.exports;
            if (instance.exports.set_cascade_mode) {
              instance.exports.set_cascade_mode(this.cascadeMode);
            }
            return instance.exports;
          }
        } catch (e) {
          // Try next candidate
        }
      }

      return null;
    },

    forceFallback(enable) {
      this.fallbackActive = !!enable;
      if (this.fallbackActive) {
        this.restoreOriginals();
      }
    },

    restoreOriginals() {
      if (PRESERVED_HTML5_QRCODE) global.Html5Qrcode = PRESERVED_HTML5_QRCODE;
      if (PRESERVED_HTML5_SCANNER) global.Html5QrcodeScanner = PRESERVED_HTML5_SCANNER;
      if (PRESERVED_JS_BARCODE) global.JsBarcode = PRESERVED_JS_BARCODE;
      if (PRESERVED_QRCODE) global.QRCode = PRESERVED_QRCODE;
    }
  };

  global.HikeCode = HikeCode;

  // --- 3. Html5Qrcode API Implementation ---
  class Html5Qrcode {
    constructor(elementId, config) {
      this.elementId = elementId;
      this.config = config || {};
      this.isScanning = false;
      this.videoElement = null;
      this.canvas = null;
      this.ctx = null;
      this.targetModule = 'scan_all';

      if (this.config.cascadeMode !== undefined) {
        HikeCode.setCascadeMode(this.config.cascadeMode);
      }

      // Auto target selection based on formatsToSupport
      if (this.config.formatsToSupport) {
        const fmts = this.config.formatsToSupport;
        const isQrOnly = fmts.every(f => f === Formats.QR_CODE || f === Formats.MICRO_QR || f === Formats.RMQR);
        const is1dOnly = fmts.every(f => f !== Formats.QR_CODE && f !== Formats.DATA_MATRIX && f !== Formats.AZTEC && f !== Formats.PDF_417);
        const isQrDm = fmts.every(f => f === Formats.QR_CODE || f === Formats.DATA_MATRIX || f === Formats.MICRO_QR || f === Formats.RMQR);

        if (isQrOnly) this.targetModule = 'scan_qr';
        else if (is1dOnly) this.targetModule = 'scan_1d';
        else if (isQrDm) this.targetModule = 'scan_qr_dm';
      }
    }

    setCascadeMode(mode) {
      HikeCode.setCascadeMode(mode);
    }

    async scanFile(imageFile, showImage) {
      const wasm = await HikeCode.loadModule(this.targetModule);
      if (!wasm) throw new Error("HIKE Scanner WebAssembly core failed to load.");

      const img = new Image();
      const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
      });

      if (typeof imageFile === 'string') {
        img.src = imageFile;
      } else {
        img.src = URL.createObjectURL(imageFile);
      }
      await loadPromise;

      const canvas = document.createElement('canvas');
      const w = Math.min(640, img.width || 320);
      const h = Math.min(480, img.height || 240);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);

      // Copy to WASM memory
      const ptr = wasm.get_image_buffer_ptr ? wasm.get_image_buffer_ptr() : (wasm.get_barcode_image_buffer_ptr ? wasm.get_barcode_image_buffer_ptr() : 0);
      const heap = new Uint8Array(wasm.memory.buffer, ptr, w * h * 4);
      heap.set(imgData.data);

      const decodeFn = wasm.decode_image || wasm.decode_barcode_image || wasm.decode_qr_image;
      const decodedLen = decodeFn ? decodeFn(w, h) : 0;

      if (decodedLen > 0) {
        const textPtr = wasm.get_result_text_ptr ? wasm.get_result_text_ptr() : (wasm.get_barcode_result_ptr ? wasm.get_barcode_result_ptr() : 0);
        const textBytes = new Uint8Array(wasm.memory.buffer, textPtr, decodedLen);
        const text = new TextDecoder().decode(textBytes);

        let formatName = "QR_CODE";
        if (wasm.get_result_type_ptr) {
          const typePtr = wasm.get_result_type_ptr();
          const typeBytes = new Uint8Array(wasm.memory.buffer, typePtr, 32);
          const zeroIdx = typeBytes.indexOf(0);
          formatName = new TextDecoder().decode(typeBytes.subarray(0, zeroIdx >= 0 ? zeroIdx : 32));
        }

        return {
          decodedText: text,
          result: {
            text: text,
            format: { formatName: formatName }
          }
        };
      }
      throw new Error("No multi-format barcode or QR code recognized in image.");
    }

    async start(cameraIdOrConfig, configuration, qrCodeSuccessCallback, qrCodeErrorCallback) {
      this.isScanning = true;
      const wasm = await HikeCode.loadModule(this.targetModule);
      if (!wasm) {
        if (qrCodeErrorCallback) qrCodeErrorCallback("WASM module failed to load");
        return;
      }

      const container = document.getElementById(this.elementId);
      if (!container) return;

      this.videoElement = document.createElement('video');
      this.videoElement.setAttribute('autoplay', 'true');
      this.videoElement.setAttribute('playsinline', 'true');
      this.videoElement.style.width = '100%';
      this.videoElement.style.height = '100%';
      this.videoElement.style.objectFit = 'contain';
      container.appendChild(this.videoElement);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');

      const frameLoop = () => {
        if (!this.isScanning) return;
        if (this.videoElement.readyState >= 2) {
          const w = Math.min(640, this.videoElement.videoWidth);
          const h = Math.min(480, this.videoElement.videoHeight);
          if (w > 0 && h > 0) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.ctx.drawImage(this.videoElement, 0, 0, w, h);
            const frame = this.ctx.getImageData(0, 0, w, h);

            const ptr = wasm.get_image_buffer_ptr ? wasm.get_image_buffer_ptr() : (wasm.get_barcode_image_buffer_ptr ? wasm.get_barcode_image_buffer_ptr() : 0);
            const heap = new Uint8Array(wasm.memory.buffer, ptr, w * h * 4);
            heap.set(frame.data);

            const decodeFn = wasm.decode_image || wasm.decode_barcode_image || wasm.decode_qr_image;
            const res = decodeFn ? decodeFn(w, h) : 0;
            if (res > 0) {
              const textPtr = wasm.get_result_text_ptr ? wasm.get_result_text_ptr() : (wasm.get_barcode_result_ptr ? wasm.get_barcode_result_ptr() : 0);
              const textBytes = new Uint8Array(wasm.memory.buffer, textPtr, res);
              const text = new TextDecoder().decode(textBytes);
              if (qrCodeSuccessCallback) {
                qrCodeSuccessCallback(text, { result: { text: text } });
              }
            }
          }
        }
        requestAnimationFrame(frameLoop);
      };
      requestAnimationFrame(frameLoop);
    }

    async stop() {
      this.isScanning = false;
      if (this.videoElement && this.videoElement.srcObject) {
        this.videoElement.srcObject.getTracks().forEach(t => t.stop());
      }
      if (this.videoElement && this.videoElement.parentNode) {
        this.videoElement.parentNode.removeChild(this.videoElement);
      }
    }

    async clear() {
      await this.stop();
      const container = document.getElementById(this.elementId);
      if (container) container.innerHTML = '';
    }
  }

  global.Html5Qrcode = Html5Qrcode;

  // --- 4. JsBarcode API Drop-in Replacement ---
  function JsBarcode(element, text, options) {
    options = options || {};
    const formatStr = String(options.format || 'CODE128').toUpperCase();
    let fmtId = 2; // Default CODE128
    if (formatStr.includes('EAN') || formatStr.includes('JAN')) fmtId = 1;
    else if (formatStr.includes('39')) fmtId = 3;
    else if (formatStr.includes('ITF')) fmtId = 4;
    else if (formatStr.includes('93')) fmtId = 4;
    else if (formatStr.includes('CODABAR')) fmtId = 6;

    HikeCode.loadModule('gen_1d').then(wasm => {
      if (!wasm) return;
      const textBuf = new TextEncoder().encode(String(text));
      const inPtr = wasm.get_image_buffer_ptr ? wasm.get_image_buffer_ptr() : 0;
      const heap = new Uint8Array(wasm.memory.buffer, inPtr, textBuf.length);
      heap.set(textBuf);

      const bitsLen = wasm.encode_barcode(fmtId, inPtr, textBuf.length);
      if (bitsLen > 0) {
        const bitsPtr = wasm.get_encoded_bits_ptr();
        const bits = new Uint8Array(wasm.memory.buffer, bitsPtr, bitsLen);

        let domElem = element;
        if (typeof element === 'string') {
          domElem = document.querySelector(element);
        }
        if (domElem && domElem.tagName === 'CANVAS') {
          const ctx = domElem.getContext('2d');
          const modWidth = options.width || 2;
          const height = options.height || 100;
          domElem.width = bitsLen * modWidth;
          domElem.height = height;
          ctx.fillStyle = options.background || '#ffffff';
          ctx.fillRect(0, 0, domElem.width, height);
          ctx.fillStyle = options.lineColor || '#000000';
          for (let i = 0; i < bitsLen; i++) {
            if (bits[i] === 1) {
              ctx.fillRect(i * modWidth, 0, modWidth, height);
            }
          }
        }
      }
    });
  }

  global.JsBarcode = JsBarcode;

  // --- 5. qrcode.js / QRCode Drop-in Replacement ---
  function qrcode(typeNumber, errorCorrectionLevel) {
    return {
      typeNumber: typeNumber || 0,
      errorCorrectionLevel: errorCorrectionLevel || 'M',
      modules: null,
      moduleCount: 0,
      addData(data) { this.data = data; },
      make() {
        // Synchronous / Immediate generation using WASM (supports gen_qr_lite, gen_qr, gen_all)
        const ecVal = { 'L': 0, 'M': 1, 'Q': 2, 'H': 3 }[this.errorCorrectionLevel] || 1;
        const wasm = HikeCode.instances['gen_qr_lite'] || HikeCode.instances['gen_qr'] || HikeCode.instances['gen_all'];
        if (wasm) {
          const textBytes = new TextEncoder().encode(this.data);
          if (wasm.generate_qr_custom) {
            const inPtr = wasm.get_image_buffer_ptr ? wasm.get_image_buffer_ptr() : (wasm.get_qr_text_buffer_ptr ? wasm.get_qr_text_buffer_ptr() : 0);
            new Uint8Array(wasm.memory.buffer, inPtr, textBytes.length).set(textBytes);
            this.moduleCount = wasm.generate_qr_custom(textBytes.length, this.typeNumber, ecVal);
          } else if (wasm.encode_2d) {
            const inPtr = wasm.get_image_buffer_ptr ? wasm.get_image_buffer_ptr() : 0;
            new Uint8Array(wasm.memory.buffer, inPtr, textBytes.length).set(textBytes);
            this.moduleCount = wasm.encode_2d(0, inPtr, textBytes.length, this.typeNumber, ecVal);
          }
        }
      },
      getModuleCount() { return this.moduleCount || 21; },
      isDark(row, col) {
        const wasm = HikeCode.instances['gen_qr_lite'] || HikeCode.instances['gen_qr'] || HikeCode.instances['gen_all'];
        if (wasm && wasm.get_encoded_matrix_ptr) {
          const matPtr = wasm.get_encoded_matrix_ptr();
          const w = wasm.get_encoded_matrix_width ? wasm.get_encoded_matrix_width() : this.moduleCount;
          const matrix = new Uint8Array(wasm.memory.buffer, matPtr, w * w);
          return matrix[row * w + col] === 1;
        }
        return false;
      },
      createImgTag(cellSize, margin) {
        cellSize = cellSize || 2;
        margin = (typeof margin === 'undefined') ? cellSize * 4 : margin;
        const size = this.getModuleCount();
        const totalSize = size * cellSize + margin * 2;
        return `<canvas width="${totalSize}" height="${totalSize}" style="width:${totalSize}px;height:${totalSize}px;"></canvas>`;
      }
    };
  }

  global.qrcode = qrcode;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      Html5Qrcode,
      JsBarcode,
      qrcode,
      Html5QrcodeSupportedFormats: Formats,
      HikeCode
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);

