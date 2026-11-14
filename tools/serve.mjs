/**
 * Tiny static file server for local preview: node tools/serve.mjs [port]
 * Serves the repo root at http://127.0.0.1:8143 by default.
 *
 * Compresses text assets with gzip when the client accepts it — GitHub
 * Pages serves the same files gzipped, so this keeps the Lighthouse budget
 * job measuring something close to production instead of a worst case.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { extname, join, normalize, sep } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] ?? 8143);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/** Types worth gzipping (everything textual — images are already compressed). */
const COMPRESSIBLE = new Set([
  '.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.txt',
]);

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT + sep) && file !== ROOT) throw new Error('traversal');
    const data = await readFile(file);
    const type = MIME[extname(file)] ?? 'application/octet-stream';
    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
    if (acceptsGzip && COMPRESSIBLE.has(extname(file)) && data.length > 1024) {
      const gz = gzipSync(data, { level: 9 });
      res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'Content-Encoding': 'gzip',
        Vary: 'Accept-Encoding',
      });
      res.end(gz);
      return;
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Chat Launcher dev server → http://127.0.0.1:${PORT}/`);
});
