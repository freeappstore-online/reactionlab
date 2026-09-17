/**
 * Generates the PWA PNG icons with zero dependencies.
 *
 * Rasterises a tiny vector description (rounded square + ring + bolt) into RGBA
 * pixels with 3x supersampling, then encodes a PNG using node:zlib. Run with
 * `pnpm icons` after changing the mark.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../web/public/icons');

const BG = [0x10, 0x11, 0x14];
const ACCENT = [0x2b, 0x6b, 0xff];
const SS = 3; // supersampling factor

/* ------------------------------------------------------------------ shapes */

const roundedSquare = (x, y, size, radius) => {
  const min = radius;
  const max = size - radius;
  const cx = Math.min(Math.max(x, min), max);
  const cy = Math.min(Math.max(y, min), max);
  return Math.hypot(x - cx, y - cy) <= radius;
};

const ring = (x, y, cx, cy, outer, inner) => {
  const d = Math.hypot(x - cx, y - cy);
  return d <= outer && d >= inner;
};

/** Even-odd point-in-polygon test. */
const inPolygon = (x, y, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** The bolt, in a 0..1 unit box. */
const BOLT = [
  [0.55, 0.14],
  [0.33, 0.53],
  [0.48, 0.53],
  [0.43, 0.86],
  [0.67, 0.45],
  [0.52, 0.45],
];

const blend = (over, under, alpha) => over.map((c, i) => Math.round(c * alpha + under[i] * (1 - alpha)));

/**
 * @param size    output edge length in px
 * @param maskable when true the mark is inset to survive Android's safe-zone crop
 */
function render(size, maskable) {
  const px = new Uint8Array(size * size * 4);
  const inset = maskable ? size * 0.18 : 0;
  const box = size - inset * 2;
  const radius = maskable ? size / 2 : size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgHits = 0;
      let fgHits = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px1 = x + (sx + 0.5) / SS;
          const py1 = y + (sy + 0.5) / SS;

          // Background plate: full-bleed for maskable, rounded square otherwise.
          const onPlate = maskable
            ? true
            : roundedSquare(px1, py1, size, radius);
          if (onPlate) bgHits++;

          const ux = (px1 - inset) / box;
          const uy = (py1 - inset) / box;
          const onRing = ring(px1, py1, size / 2, size / 2, box * 0.32, box * 0.265);
          const onBolt = ux >= 0 && ux <= 1 && uy >= 0 && uy <= 1 && inPolygon(ux, uy, BOLT);
          if ((onRing || onBolt) && onPlate) fgHits++;
        }
      }

      const total = SS * SS;
      const bgAlpha = bgHits / total;
      const fgAlpha = fgHits / total;
      const rgb = blend(ACCENT, BG, fgAlpha);

      const i = (y * size + x) * 4;
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = Math.round(bgAlpha * 255);
    }
  }
  return px;
}

/* --------------------------------------------------------------- png encode */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};

function encodePng(size, rgba) {
  const stride = size * 4;
  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------------------------------------------------------- generate */

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['apple-touch-icon.png', 180, false],
  ['maskable-512.png', 512, true],
];

for (const [name, size, maskable] of targets) {
  const png = encodePng(size, render(size, maskable));
  writeFileSync(resolve(OUT_DIR, name), png);
  console.log(name + '  ' + size + 'x' + size + '  ' + (png.length / 1024).toFixed(1) + ' KB');
}
