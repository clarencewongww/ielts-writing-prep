#!/usr/bin/env node
/**
 * Generates the PWA icon set — entirely offline, no dependencies, no fetch.
 *
 * The mark is drawn from the product's own subject matter: a stopwatch whose
 * minute hand is a pen. One rasteriser, four PNGs:
 *
 *   public/icons/icon-192.png       any
 *   public/icons/icon-512.png       any
 *   public/icons/maskable-192.png   maskable (glyph at 60% of the canvas)
 *   public/icons/maskable-512.png   maskable (glyph at 60% of the canvas)
 *
 * Why a script instead of committed SVG: the manifest needs PNG for both the
 * 192 and 512 sizes (Chrome install criteria) and maskable must have a 20%
 * safe-zone padding, so the geometry is parameterised and rasterised here.
 *
 * Implementation notes
 *  - PNG is encoded by hand (IHDR/IDAT/IEND + CRC32 + zlib deflate). Node core
 *    only, so the build stays hermetic and the repo needs no image toolchain.
 *  - The glyph is a small set of signed-distance primitives (annulus, capsule
 *    with interpolated radius, disc) sampled 4x4 per pixel. That gives clean
 *    anti-aliased edges at 192 and 512 from a single source of truth.
 *  - Colors are the app tokens: accent #0071E3 -> accent-strong #0058B0
 *    vertically, glyph white. White on #0071E3 is 4.70:1 (non-text: >= 3:1).
 *
 * Run once (and by `npm run prebuild`): node scripts/generate-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "icons");

/* ------------------------------------------------------------------ PNG ---- */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** Encode straight RGBA bytes as an 8-bit RGBA PNG (filter 0 per scanline). */
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: truecolor + alpha
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------- geometry ---- */

const ACCENT = [0x00, 0x71, 0xe3]; // --accent       #0071E3
const ACCENT_STRONG = [0x00, 0x58, 0xb0]; // --accent-strong #0058B0
const GLYPH = [0xff, 0xff, 0xff];

/**
 * Glyph primitives in canvas fractions (centre 0.5, 0.5; +y is down).
 * `scale` shrinks everything around the centre: 1 for `any`, 0.78 for
 * `maskable`, which brings the widest extent (crown top, r = 0.384) to
 * r = 0.30 — a 20% safe-zone padding on every edge.
 */
const GLYPH_SHAPES = [
  // Bezel: a ring, the stopwatch face outline.
  { kind: "ring", r: 0.272, w: 0.042 },
  // Crown/button above the face.
  { kind: "capsule", a: [0.5, 0.5 - 0.354], b: [0.5, 0.5 - 0.262], r0: 0.03, r1: 0.03 },
  // Minute hand — a pen, tapering to its nib at ~1 o'clock.
  { kind: "capsule", a: [0.5, 0.5], b: [0.6372, 0.3477], r0: 0.05, r1: 0.019 },
  // Hour hand at ~10 o'clock.
  { kind: "capsule", a: [0.5, 0.5], b: [0.3978, 0.441], r0: 0.046, r1: 0.046 },
  // Centre pin.
  { kind: "disc", r: 0.04 },
];

/**
 * Is canvas point (x, y) inside the glyph? `scale` shrinks the *shape* toward
 * (cx, cy); the sample point is never transformed. Scaling both would cancel
 * exactly (point and geometry shrink together), rendering `maskable` identical
 * to `any` — the bug this function must not reintroduce.
 */
function inside(shape, x, y, cx, cy, scale) {
  const dx = x - cx;
  const dy = y - cy;

  switch (shape.kind) {
    case "disc": {
      const r = shape.r * scale;
      return dx * dx + dy * dy <= r * r;
    }
    case "ring": {
      const d = Math.hypot(dx, dy);
      const mid = shape.r * scale;
      const half = (shape.w / 2) * scale;
      return d >= mid - half && d <= mid + half;
    }
    case "capsule": {
      const ax = cx + (shape.a[0] - cx) * scale;
      const ay = cy + (shape.a[1] - cy) * scale;
      const bx = cx + (shape.b[0] - cx) * scale;
      const by = cy + (shape.b[1] - cy) * scale;
      const vx = bx - ax;
      const vy = by - ay;
      const lenSq = vx * vx + vy * vy;
      const t = lenSq === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * vx + (y - ay) * vy) / lenSq));
      const qx = ax + vx * t - x;
      const qy = ay + vy * t - y;
      const r = (shape.r0 + (shape.r1 - shape.r0) * t) * scale;
      return qx * qx + qy * qy <= r * r;
    }
    default:
      throw new Error(`unknown shape: ${shape.kind}`);
  }
}

/**
 * Rasterise the icon. `maskable` shrinks the glyph and leaves the background
 * full-bleed (the mask, not the icon, owns the silhouette).
 */
function render(size, { maskable }) {
  const samples = 4; // 4x4 supersampling per pixel
  const scale = maskable ? 0.78 : 1;
  const cx = 0.5;
  const cy = 0.5;
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = (x + (sx + 0.5) / samples) / size;
          const py = (y + (sy + 0.5) / samples) / size;

          const t = py; // subtle vertical accent -> accent-strong gradient
          let sr = ACCENT[0] + (ACCENT_STRONG[0] - ACCENT[0]) * t;
          let sg = ACCENT[1] + (ACCENT_STRONG[1] - ACCENT[1]) * t;
          let sb = ACCENT[2] + (ACCENT_STRONG[2] - ACCENT[2]) * t;

          for (const shape of GLYPH_SHAPES) {
            if (inside(shape, px, py, cx, cy, scale)) {
              sr = GLYPH[0];
              sg = GLYPH[1];
              sb = GLYPH[2];
              break;
            }
          }

          r += sr;
          g += sg;
          b += sb;
        }
      }

      const count = samples * samples;
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(r / count);
      rgba[i + 1] = Math.round(g / count);
      rgba[i + 2] = Math.round(b / count);
      rgba[i + 3] = 255; // opaque: iOS apple-touch-icons must not be transparent
    }
  }

  return encodePng(size, size, rgba);
}

/* ------------------------------------------------------------------ main ---- */

/** Tiny operator preview so a headless run can be eyeballed in the terminal. */
function preview(size, { maskable }) {
  const cols = 32;
  const rows = 16;
  const scale = maskable ? 0.78 : 1;
  const lines = [];
  for (let row = 0; row < rows; row += 1) {
    let line = "";
    for (let col = 0; col < cols; col += 1) {
      const x = (col + 0.5) / cols;
      const y = (row + 0.5) / rows;
      const inked = GLYPH_SHAPES.some((shape) => inside(shape, x, y, 0.5, 0.5, scale));
      line += inked ? "#" : ".";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

const TARGETS = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "maskable-192.png", size: 192, maskable: true },
  { file: "maskable-512.png", size: 512, maskable: true },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  const png = render(target.size, target);
  const path = join(OUT_DIR, target.file);
  writeFileSync(path, png);
  const { size } = statSync(path);
  console.log(
    `[icons] ${target.file.padEnd(18)} ${target.size}x${target.size}  ${(size / 1024).toFixed(1)} kB`,
  );
}

console.log(`[icons] written to ${join("public", "icons")}\n`);
console.log(`[icons] preview — any (scale 1.00):\n${preview(192, { maskable: false })}`);
console.log(
  `\n[icons] preview — maskable (scale 0.78, smaller glyph + 20% padding):\n${preview(192, { maskable: true })}`,
);
