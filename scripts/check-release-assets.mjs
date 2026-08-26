#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const pngSignature = '89504e470d0a1a0a';
const assets = [
  ['assets/icon.png', 1024, 1024],
  ['assets/adaptive-icon.png', 1024, 1024],
  ['assets/adaptive-icon-monochrome.png', 1024, 1024],
  ['assets/favicon.png', 64, 64],
  ['assets/splash.png', 1242, 2436],
];

const errors = [];

for (const [assetPath, expectedWidth, expectedHeight] of assets) {
  try {
    const contents = readFileSync(new URL(`../${assetPath}`, import.meta.url));
    const signature = contents.subarray(0, 8).toString('hex');
    const width = contents.readUInt32BE(16);
    const height = contents.readUInt32BE(20);

    if (signature !== pngSignature) {
      errors.push(`${assetPath} is not a PNG file.`);
      continue;
    }

    if (width !== expectedWidth || height !== expectedHeight) {
      errors.push(
        `${assetPath} is ${width}x${height}; expected ${expectedWidth}x${expectedHeight}.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${assetPath} could not be read: ${message}`);
  }
}

if (errors.length > 0) {
  console.error('Release asset validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Release asset validation passed for ${assets.length} files.`);
