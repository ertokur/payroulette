// Generates PNG app icons without dependencies: node tools/gen-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const COLORS = ["#ff4f8b", "#ffc94a", "#7c5cff", "#22d3a6", "#ff8a3d", "#3dbbff"];
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex("#140b24"), BG2 = hex("#4a1f7a"), GOLD = hex("#ffc94a"), DARK = hex("#7a3d00"), WHITE = [255, 255, 255];

// returns [r,g,b] for a point in unit coords (0..1), scale = wheel radius factor
function shadePoint(x, y, scale) {
  const cx = 0.5, cy = 0.53;
  const dx = x - cx, dy = y - cy;
  const d = Math.hypot(dx, dy);
  const R = 0.40 * scale;
  // background radial
  const t = Math.min(1, Math.hypot(x - 0.5, y - 0.2) / 0.9);
  let col = BG2.map((v, i) => v * (1 - t) + BG[i] * t);

  if (d < R * 1.08) col = d > R ? GOLD : col;
  if (d <= R) {
    let a = Math.atan2(dy, dx) + Math.PI / 2 + Math.PI / 6; // align segments
    a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const seg = Math.floor(a / (Math.PI / 3));
    const base = hex(COLORS[seg]);
    const k = 1.15 - 0.4 * (d / R);
    col = base.map(v => Math.min(255, v * k));
    // segment separators
    const local = a - seg * (Math.PI / 3);
    if (Math.min(local, Math.PI / 3 - local) * d < 0.006 * scale) col = WHITE;
  }
  // hub
  if (d < R * 0.22) col = d > R * 0.17 ? DARK : GOLD;
  // pointer (triangle at top)
  const py = cy - R * 1.12;
  const ph = R * 0.42, pw = R * 0.26;
  if (y > py - ph * 0.15 && y < py + ph) {
    const rel = (y - (py - ph * 0.15)) / (ph * 1.15);
    const half = pw * (1 - rel);
    if (Math.abs(x - cx) < half) col = Math.abs(x - cx) > half - 0.012 * scale ? DARK : GOLD;
  }
  return col;
}

function render(size, scale) {
  const ss = 3;
  const buf = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    buf[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = shadePoint((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size, scale);
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      buf[o] = r / (ss * ss); buf[o + 1] = g / (ss * ss); buf[o + 2] = b / (ss * ss); buf[o + 3] = 255;
    }
  }
  return png(size, size, buf);
}

function crc32(b) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < b.length; n++) {
    c = (crc ^ b[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const out = path.join(__dirname, "..", "icons");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "icon-192.png"), render(192, 1.1));
fs.writeFileSync(path.join(out, "icon-512.png"), render(512, 1.1));
fs.writeFileSync(path.join(out, "icon-maskable-512.png"), render(512, 0.85));
fs.writeFileSync(path.join(out, "apple-touch-icon.png"), render(180, 1.05));
console.log("icons written to", out);
