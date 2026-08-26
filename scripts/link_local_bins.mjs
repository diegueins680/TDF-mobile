import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BIN_DIR = resolve(ROOT, 'node_modules/.bin');
const BIN_PATH = resolve(BIN_DIR, 'expo-doctor');
const TARGET_PATH = resolve(ROOT, 'tools/expo-doctor/bin/expo-doctor.js');

if (!existsSync(TARGET_PATH)) {
  console.error(`Cannot link expo-doctor; missing ${TARGET_PATH}`);
  process.exit(1);
}

mkdirSync(dirname(BIN_PATH), { recursive: true });

writeFileSync(
  BIN_PATH,
  `#!/bin/sh
exec node "${TARGET_PATH}" "$@"
`,
);

chmodSync(BIN_PATH, 0o755);
console.log('Linked local expo-doctor binary.');
