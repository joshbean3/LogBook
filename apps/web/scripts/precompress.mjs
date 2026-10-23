// After `vite build`: write a .br and a .gz next to every compressible file in dist, so the API can send them as they are
// (hono's serveStatic `precompressed`) with the right Content-Encoding. Hashed assets are immutable, so the siblings are too.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const dist = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const COMPRESSIBLE = /\.(?:js|mjs|css|svg|json|html|webmanifest|map|txt|xml)$/i;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));

let n = 0;
let raw = 0;
let br = 0;
let gz = 0;
for (const file of walk(dist)) {
  if (!COMPRESSIBLE.test(file)) continue;
  const src = fs.readFileSync(file);
  // anything under ~1 KB is not worth a second file: a compressed body is not smaller than a packet
  if (src.length < 1024) continue;
  const b = zlib.brotliCompressSync(src, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: src.length } });
  const g = zlib.gzipSync(src, { level: 9 });
  fs.writeFileSync(`${file}.br`, b);
  fs.writeFileSync(`${file}.gz`, g);
  n++;
  raw += src.length;
  br += b.length;
  gz += g.length;
}
const kb = (x) => `${(x / 1024).toFixed(0)} KB`;
console.log(`precompressed ${n} files: ${kb(raw)} raw → ${kb(gz)} gzip, ${kb(br)} brotli`);
