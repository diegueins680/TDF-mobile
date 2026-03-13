#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const profile = (process.env.EAS_BUILD_PROFILE ?? 'production').trim() || 'production';

const readEnv = (name) => {
  const value = process.env[name]?.trim();
  return value ? value : '';
};

const parsePositiveInteger = (value) => /^\d+$/.test(value) && Number.parseInt(value, 10) > 0;

const required = ['EXPO_PUBLIC_API_BASE', 'EXPO_PUBLIC_UPLOAD_URL'];
const missing = required.filter((name) => !readEnv(name));
const embeddedToken = readEnv('EXPO_PUBLIC_API_TOKEN');
const iosBuildNumber = readEnv('IOS_BUILD_NUMBER') || '1';
const androidVersionCode = readEnv('ANDROID_VERSION_CODE') || '1';

const errors = [];

if (missing.length > 0) {
  errors.push(`Missing required variables: ${missing.join(', ')}`);
}
if (embeddedToken) {
  errors.push('EXPO_PUBLIC_API_TOKEN must be empty for store builds.');
}
if (!parsePositiveInteger(iosBuildNumber)) {
  errors.push('IOS_BUILD_NUMBER must be a positive integer.');
}
if (!parsePositiveInteger(androidVersionCode)) {
  errors.push('ANDROID_VERSION_CODE must be a positive integer.');
}

if (errors.length > 0) {
  console.error(`Release validation failed for profile "${profile}".`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Release validation passed for profile "${profile}".`);
console.log(`App version: ${pkg.version}`);
console.log(`iOS build number: ${iosBuildNumber}`);
console.log(`Android version code: ${androidVersionCode}`);
console.log(`API base: ${readEnv('EXPO_PUBLIC_API_BASE')}`);
console.log(`Upload URL: ${readEnv('EXPO_PUBLIC_UPLOAD_URL')}`);
