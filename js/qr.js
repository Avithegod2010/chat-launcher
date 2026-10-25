/**
 * QR rendering wrapper around the vendored qrcode-generator (MIT,
 * Kazuhiko Arase — see js/vendor/qrcode-generator.js). Draws to a canvas
 * with quiet-zone margin; degrades to a "copy link" hint when the library
 * is unavailable.
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} text payload (a URL in practice)
 * @param {number} [size] css pixels (device pixel ratio handled)
 * @returns {boolean} false when the vendor script is missing
 */
export function drawQr(canvas, text, size = 264) {
  const qrcode = globalThis.qrcode;
  if (typeof qrcode !== 'function') return false;
  let qr;
  try {
    qr = qrcode(0, 'M'); // auto version, medium error correction
    qr.addData(text);
    qr.make();
  } catch {
    return false;
  }
  const modules = qr.getModuleCount();
  const margin = 2; // quiet-zone modules
  const total = modules + margin * 2;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  const cell = (size * dpr) / total;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0b1020';
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (qr.isDark(y, x)) {
        ctx.fillRect(
          Math.floor((x + margin) * cell),
          Math.floor((y + margin) * cell),
          Math.ceil(cell),
          Math.ceil(cell),
        );
      }
    }
  }
  return true;
}
