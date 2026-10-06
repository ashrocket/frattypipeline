#!/usr/bin/env node
// Mean perceived lightness of PNG screenshots (8-bit RGB/RGBA, non-interlaced).
// Usage: node luminance.mjs shot.png [more.png...]
// PASS = mean perceived lightness (CIE L*/100) >= 0.55 and < 10% near-black pixels.
// The pre-v4 night build measured 0.25-0.32 with 45-72% near-black.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

function decode(path) {
  const buf = readFileSync(path);
  let pos = 8,
    width = 0,
    height = 0,
    depth = 0,
    type = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
      if (data[12] !== 0) throw Error('interlaced PNG not supported');
    } else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || (type !== 2 && type !== 6)) throw Error(`unsupported PNG type ${type}/${depth}`);
  const bpp = type === 6 ? 4 : 3,
    stride = width * bpp,
    raw = inflateSync(Buffer.concat(idat)),
    out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)],
      line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0,
        b = y ? out[(y - 1) * stride + x] : 0,
        c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { width, height, bpp, pixels: out };
}
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
for (const path of process.argv.slice(2)) {
  const { width, height, bpp, pixels } = decode(path);
  let sum = 0,
    dark = 0;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const o = i * bpp,
      l = 0.2126 * lin(pixels[o]) + 0.7152 * lin(pixels[o + 1]) + 0.0722 * lin(pixels[o + 2]);
    // Perceived lightness (CIE L*) is closer to what players mean by "dark".
    const lstar = l <= 216 / 24389 ? (l * 24389) / 27 : 116 * Math.cbrt(l) - 16;
    sum += lstar / 100;
    if (lstar < 25) dark++;
  }
  const mean = sum / n;
  console.log(
    `${path}: ${width}x${height} mean lightness ${mean.toFixed(3)} · near-black share ${((dark / n) * 100).toFixed(1)}% · ${mean >= 0.55 && dark / n < 0.1 ? 'PASS' : 'TOO DARK'}`,
  );
}
