#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const outputDir = path.resolve(process.cwd(), 'assets/release');

const COLORS = {
  bgTop: [15, 23, 42, 255],
  bgBottom: [8, 15, 32, 255],
  accentBlue: [56, 189, 248, 255],
  accentGold: [245, 158, 11, 255],
  accentSlate: [51, 65, 85, 255],
  accentIce: [226, 232, 240, 255],
  transparent: [0, 0, 0, 0],
  white: [255, 255, 255, 255]
};

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function mix(left, right, amount) {
  return left + ((right - left) * amount);
}

function mixColor(left, right, amount) {
  return [
    Math.round(mix(left[0], right[0], amount)),
    Math.round(mix(left[1], right[1], amount)),
    Math.round(mix(left[2], right[2], amount)),
    Math.round(mix(left[3], right[3], amount))
  ];
}

function withAlpha(color, amount) {
  return [color[0], color[1], color[2], Math.round(color[3] * clamp(amount))];
}

function blend(base, over) {
  const alpha = over[3] / 255;
  const inv = 1 - alpha;
  return [
    Math.round((over[0] * alpha) + (base[0] * inv)),
    Math.round((over[1] * alpha) + (base[1] * inv)),
    Math.round((over[2] * alpha) + (base[2] * inv)),
    Math.round(over[3] + (base[3] * inv))
  ];
}

function circleMask(x, y, cx, cy, radius, feather) {
  const distance = Math.hypot(x - cx, y - cy) - radius;
  return clamp(1 - (distance / feather));
}

function ringMask(x, y, cx, cy, outerRadius, innerRadius, feather) {
  return clamp(
    circleMask(x, y, cx, cy, outerRadius, feather) -
      circleMask(x, y, cx, cy, innerRadius, feather)
  );
}

function roundedRectMask(x, y, cx, cy, width, height, radius, feather) {
  const dx = Math.abs(x - cx) - ((width / 2) - radius);
  const dy = Math.abs(y - cy) - ((height / 2) - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - radius;
  const inside = Math.min(Math.max(dx, dy), 0);
  return clamp(1 - ((outside + inside) / feather));
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  let crc = 0xffffffff;
  for (const byte of typeBuffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, samplePixel) {
  const bytes = Buffer.alloc(((width * 4) + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * ((width * 4) + 1);
    bytes[rowOffset] = 0;

    for (let x = 0; x < width; x += 1) {
      const pixel = samplePixel(x + 0.5, y + 0.5, width, height);
      const offset = rowOffset + 1 + (x * 4);
      bytes[offset] = pixel[0];
      bytes[offset + 1] = pixel[1];
      bytes[offset + 2] = pixel[2];
      bytes[offset + 3] = pixel[3];
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    signature,
    makeChunk('IHDR', header),
    makeChunk('IDAT', zlib.deflateSync(bytes, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function addMark(base, x, y, size, options = {}) {
  const {
    transparent = false,
    monochrome = false,
    scale = 1,
    anchorX = 0.42,
    anchorY = 0.5
  } = options;
  const centerX = size * anchorX;
  const centerY = size * anchorY;
  const recordRadius = size * 0.275 * scale;
  const innerRadius = recordRadius * 0.42;
  const feather = Math.max(size * 0.004, 1.25);
  const recordFill = monochrome ? COLORS.white : [22, 36, 60, 255];
  const barPrimary = monochrome ? COLORS.white : COLORS.accentBlue;
  const barAccent = monochrome ? COLORS.white : COLORS.accentGold;
  const ringPrimary = monochrome ? COLORS.white : COLORS.accentGold;
  const ringSecondary = monochrome ? COLORS.white : COLORS.accentBlue;
  let pixel = base;

  if (!transparent && !monochrome) {
    const glow = circleMask(x, y, size * 0.28, size * 0.28, size * 0.42, size * 0.13);
    pixel = blend(pixel, withAlpha(COLORS.accentBlue, glow * 0.18));
  }

  pixel = blend(pixel, withAlpha(recordFill, circleMask(x, y, centerX, centerY, recordRadius, feather)));
  pixel = blend(pixel, withAlpha(ringPrimary, ringMask(x, y, centerX, centerY, recordRadius, recordRadius * 0.88, feather)));
  pixel = blend(pixel, withAlpha(ringSecondary, ringMask(x, y, centerX, centerY, recordRadius * 0.73, recordRadius * 0.68, feather)));
  pixel = blend(pixel, withAlpha(monochrome ? COLORS.white : COLORS.accentSlate, ringMask(x, y, centerX, centerY, recordRadius * 0.58, recordRadius * 0.53, feather)));
  pixel = blend(pixel, withAlpha(monochrome ? COLORS.white : COLORS.accentIce, ringMask(x, y, centerX, centerY, recordRadius * 0.28, 0, feather)));
  pixel = blend(pixel, withAlpha(transparent ? COLORS.transparent : COLORS.bgBottom, circleMask(x, y, centerX, centerY, recordRadius * 0.08, feather)));

  const bars = [
    { cx: size * 0.64, cy: size * 0.54, width: size * 0.09, height: size * 0.24, color: barPrimary },
    { cx: size * 0.745, cy: size * 0.5, width: size * 0.09, height: size * 0.34, color: barAccent },
    { cx: size * 0.85, cy: size * 0.57, width: size * 0.09, height: size * 0.2, color: barPrimary }
  ];

  for (const bar of bars) {
    pixel = blend(
      pixel,
      withAlpha(
        bar.color,
        roundedRectMask(x, y, bar.cx, bar.cy, bar.width * scale, bar.height * scale, bar.width * 0.2, feather)
      )
    );
  }

  return pixel;
}

function renderIcon(width, height) {
  return encodePng(width, height, (x, y, imageWidth, imageHeight) => {
    const verticalMix = y / imageHeight;
    const diagonalMix = (x + y) / (imageWidth + imageHeight);
    let pixel = mixColor(COLORS.bgTop, COLORS.bgBottom, clamp((verticalMix * 0.65) + (diagonalMix * 0.35)));
    const sheen = clamp(1 - (((x - (imageWidth * 0.2)) ** 2 + (y - (imageHeight * 0.15)) ** 2) / (imageWidth * imageHeight * 0.18)));
    pixel = blend(pixel, withAlpha(COLORS.accentIce, sheen * 0.06));
    return addMark(pixel, x, y, imageWidth);
  });
}

function renderTransparentMark(width, height, options = {}) {
  return encodePng(width, height, (x, y, imageWidth) => addMark(COLORS.transparent, x, y, imageWidth, { transparent: true, ...options }));
}

function renderMonochromeMark(width, height) {
  return encodePng(width, height, (x, y, imageWidth) => addMark(COLORS.transparent, x, y, imageWidth, { transparent: true, monochrome: true }));
}

function writeAsset(fileName, buffer) {
  fs.writeFileSync(path.join(outputDir, fileName), buffer);
  process.stdout.write(`generated assets/release/${fileName}\n`);
}

fs.mkdirSync(outputDir, { recursive: true });

writeAsset('icon.png', renderIcon(1024, 1024));
writeAsset('adaptive-icon.png', renderTransparentMark(1024, 1024));
writeAsset('adaptive-monochrome.png', renderMonochromeMark(1024, 1024));
writeAsset('splash-logo.png', renderTransparentMark(1200, 1200, { scale: 0.92, anchorX: 0.44, anchorY: 0.5 }));
writeAsset('favicon.png', renderIcon(256, 256));
