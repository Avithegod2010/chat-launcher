/**
 * Accent color helpers: turn one user-picked hex into the app's gradient
 * pair (base + a hue/lightness-shifted partner) using pure HSL math.
 */

const HEX_RE = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;

/** @param {string} hex @returns {[number,number,number]|null} r,g,b 0-255 */
export function hexToRgb(hex) {
  if (typeof hex !== 'string' || !HEX_RE.test(hex)) return null;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h / 60);
  const table = [
    [c, x, 0], [x, c, 0], [0, c, x],
    [0, x, c], [x, 0, c], [c, 0, x],
  ][seg];
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(table[0])}${to(table[1])}${to(table[2])}`;
}

/**
 * Derive the gradient pair from a single accent hex: the same hue nudged
 * and lightened so the two-stop gradient reads as one family.
 * @param {string} hex user color, #rgb or #rrggbb
 * @returns {[string, string]|null} [accent, accent2]
 */
export function derivePair(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [h, s, l] = rgbToHsl(...rgb);
  const accent = hslToHex(h, Math.max(s, 0.55), Math.min(Math.max(l, 0.42), 0.62));
  const accent2 = hslToHex(h + 22, Math.max(s, 0.6), Math.min(Math.max(l + 0.14, 0.5), 0.7));
  return [accent, accent2];
}
