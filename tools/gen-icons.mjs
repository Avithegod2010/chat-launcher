/**
 * Zero-dependency PWA icon generator.
 *
 * Renders the Chat Launcher logo (indigo→violet gradient rounded square with
 * a white chat bubble and three "dots") straight to PNG using Node's built-in
 * zlib — no image libraries, no network. 4×4 supersampling gives clean
 * anti-aliased edges.
 *
 * Usage: node tools/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'icons');

/* ------------------------------------------------------------ PNG writer */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** @param {number[][]} pixels RGBA rows */
function encodePng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    const row = pixels[y];
    for (let x = 0; x < width * 4; x++) raw[o++] = row[x];
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------- rendering */

const GRAD_TOP = [0x4f, 0x46, 0xe5]; // indigo
const GRAD_BOTTOM = [0x7c, 0x3a, 0xed]; // violet
const WHITE = [255, 255, 255];

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** point in triangle via barycentric sign test */
function inTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * @param {number} size output square size in px
 * @param {{maskable?: boolean, bubbleScale?: number}} opts
 *   maskable → full-bleed opaque square (launcher applies its own mask)
 */
function renderIcon(size, { maskable = false, bubbleScale = 1 } = {}) {
  const SS = 4; // supersampling factor
  const pixels = [];
  const r = maskable ? 0 : size * 0.22; // rounded corner radius
  const cx = size / 2;
  const cy = size * 0.47;
  const R = size * 0.3 * bubbleScale;
  const dotR = size * 0.034 * bubbleScale;
  const dotDx = size * 0.105 * bubbleScale;
  const tail = [
    [cx - R * 0.45, cy + R * 0.62],
    [cx - R * 0.95, cy + R * 1.25],
    [cx + R * 0.05, cy + R * 0.78],
  ];

  for (let y = 0; y < size; y++) {
    const row = new Uint8Array(size * 4);
    for (let x = 0; x < size; x++) {
      let insideBg = 0;
      let insideGlyph = 0;
      let insideDot = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          // background square (rounded unless maskable)
          let bg;
          if (maskable) {
            bg = true;
          } else {
            const qx = Math.abs(px - cx) - (cx - r);
            const qy = Math.abs(py - size / 2) - (size / 2 - r);
            bg = Math.max(qx, qy) <= 0;
          }
          if (!bg) continue;
          insideBg++;
          const bubble =
            (px - cx) * (px - cx) + (py - cy) * (py - cy) <= R * R ||
            inTriangle(px, py, ...tail);
          if (!bubble) continue;
          insideGlyph++;
          const dot =
            (py - cy) * (py - cy) <= dotR * dotR &&
            Math.abs(px - cx) >= dotDx - dotR &&
            Math.abs(px - cx) <= dotDx + dotR;
          if (dot) insideDot++;
        }
      }
      const total = SS * SS;
      const bgA = insideBg / total;
      const dotA = insideDot / total; // dots drawn with bg color over white
      const bg = lerp(GRAD_TOP, GRAD_BOTTOM, y / size);
      if (bgA === 0) {
        row[x * 4 + 3] = 0;
        continue;
      }
      // white glyph with bg-colored dots
      const color = [0, 1, 2].map(
        (i) => bg[i] * dotA + WHITE[i] * (insideGlyph / total - dotA),
      );
      row[x * 4] = Math.round(color[0]);
      row[x * 4 + 1] = Math.round(color[1]);
      row[x * 4 + 2] = Math.round(color[2]);
      row[x * 4 + 3] = Math.round(bgA * 255);
    }
    pixels.push(row);
  }
  return encodePng(size, size, pixels);
}

/* --------------------------------------------------------------- output */

mkdirSync(OUT, { recursive: true });

const targets = [
  ['icon-192.png', renderIcon(192)],
  ['icon-512.png', renderIcon(512)],
  // maskable: opaque full-bleed, glyph inside the 80% safe zone
  ['icon-maskable-512.png', renderIcon(512, { maskable: true, bubbleScale: 0.8 })],
  // apple touch icons get masked by iOS — ship opaque squares
  ['apple-touch-icon.png', renderIcon(180, { maskable: true, bubbleScale: 0.82 })],
  ['favicon-32.png', renderIcon(32, { bubbleScale: 1.05 })],
];

for (const [name, buf] of targets) {
  writeFileSync(join(OUT, name), buf);
  console.log(`✓ icons/${name} (${buf.length} bytes)`);
}
