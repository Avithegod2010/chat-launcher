/**
 * Zip extension/ into dist/chat-launcher-extension.zip without external deps:
 * reads the zip format spec — actually uses a minimal STORED (no compression)
 * zip writer, which every unzipper accepts.
 *
 * Usage: node tools/pack-extension.mjs
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'extension');
const OUT = join(ROOT, 'dist', 'chat-launcher-extension.zip');

/** @returns {string[]} every file under dir, posix-style relative paths */
function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}

const files = walk(SRC);

/** little-endian writers */
const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
const u32 = (v) => [...u16(v & 0xffff), ...u16(Math.floor(v / 0x10000))];

const chunks = [];
const central = [];
let offset = 0;

for (const rel of files) {
  const data = readFileSync(join(SRC, rel));
  const nameBytes = Buffer.from(rel, 'utf8');

  // CRC-32 (IEEE)
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crcVal = 0xffffffff;
  for (const b of data) crcVal = table[(crcVal ^ b) & 0xff] ^ (crcVal >>> 8);
  crcVal = (crcVal ^ 0xffffffff) >>> 0;

  const local = Buffer.from([
    ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
    ...u32(crcVal), ...u32(data.length), ...u32(data.length),
    ...u16(nameBytes.length), ...u16(0),
  ]);
  chunks.push(local, nameBytes, data);
  central.push({
    nameBytes, crcVal, size: data.length, offset,
  });
  offset += local.length + nameBytes.length + data.length;
}

const centralStart = offset;
for (const { nameBytes, crcVal, size, offset: off } of central) {
  const entry = Buffer.from([
    ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
    ...u32(crcVal), ...u32(size), ...u32(size),
    ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
    ...u32(0), ...u32(off),
  ]);
  chunks.push(entry, nameBytes);
  offset += entry.length + nameBytes.length;
}
chunks.push(
  Buffer.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length),
    ...u32(offset - centralStart), ...u32(centralStart), ...u16(0),
  ]),
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat(chunks));
console.log(`✓ ${OUT} (${files.length} files)`);
