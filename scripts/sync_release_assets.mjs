import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');
const PNG_SIGNATURE = '89504e470d0a1a0a';

const RELEASE_ASSETS = [
  {
    source: 'assets/release-source/icon.png',
    target: 'assets/icon.png',
    width: 1024,
    height: 1024,
  },
  {
    source: 'assets/release-source/adaptive-icon.png',
    target: 'assets/adaptive-icon.png',
    width: 1024,
    height: 1024,
  },
  {
    source: 'assets/release-source/adaptive-icon-monochrome.png',
    target: 'assets/adaptive-icon-monochrome.png',
    width: 1024,
    height: 1024,
  },
  {
    source: 'assets/release-source/favicon.png',
    target: 'assets/favicon.png',
    width: 64,
    height: 64,
  },
  {
    source: 'assets/release-source/splash.png',
    target: 'assets/splash.png',
    width: 1242,
    height: 2436,
  },
];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function readPngDimensions(filePath) {
  const buffer = readFileSync(filePath);

  if (buffer.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) {
    throw new Error(`${filePath} is not a PNG file.`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    hash: sha256(buffer),
  };
}

function resolvePath(relativePath) {
  return resolve(ROOT, relativePath);
}

function assertExpectedImage(filePath, expected) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing required release asset: ${filePath}`);
  }

  const actual = readPngDimensions(filePath);

  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(
      `${filePath} has unexpected dimensions ${actual.width}x${actual.height}; expected ${expected.width}x${expected.height}.`,
    );
  }

  return actual;
}

const mismatches = [];
let copiedCount = 0;

for (const asset of RELEASE_ASSETS) {
  const sourcePath = resolvePath(asset.source);
  const targetPath = resolvePath(asset.target);
  const source = assertExpectedImage(sourcePath, asset);
  const targetExists = existsSync(targetPath);
  const target = targetExists ? assertExpectedImage(targetPath, asset) : null;

  if (target && target.hash === source.hash) {
    continue;
  }

  if (CHECK_ONLY) {
    mismatches.push(`${asset.target} does not match ${asset.source}`);
    continue;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
  copiedCount += 1;
}

if (mismatches.length > 0) {
  console.error('Release assets are out of sync:');
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`);
  }
  console.error('Run `npm run release:assets` to restore the canonical release asset set.');
  process.exit(1);
}

if (CHECK_ONLY) {
  console.log(`Release asset check passed for ${RELEASE_ASSETS.length} files.`);
} else {
  console.log(`Release assets ready. Updated ${copiedCount} file${copiedCount === 1 ? '' : 's'}.`);
}
