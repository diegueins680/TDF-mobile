#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const profile = (process.env.EAS_BUILD_PROFILE ?? 'production').trim() || 'production';
const releaseProfiles = new Set(['preview', 'production']);
const localApiBase = 'http://localhost:8080';
const localUploadUrl = `${localApiBase}/drive/upload`;
const releaseApiBase = 'https://tdf-hq.fly.dev';
const releaseUploadUrl = `${releaseApiBase}/drive/upload`;

const readEnv = (name) => {
  const value = process.env[name]?.trim();
  return value ? value : '';
};

const resolveReleaseAwareEnv = (name, releaseValue, localValue) => {
  const explicitValue = readEnv(name);
  if (explicitValue) {
    return explicitValue;
  }

  return releaseProfiles.has(profile) ? releaseValue : localValue;
};

const embeddedToken = readEnv('EXPO_PUBLIC_API_TOKEN');
const apiBase = resolveReleaseAwareEnv('EXPO_PUBLIC_API_BASE', releaseApiBase, localApiBase);
const uploadUrl = resolveReleaseAwareEnv('EXPO_PUBLIC_UPLOAD_URL', releaseUploadUrl, localUploadUrl);

const errors = [];

try {
  new URL(apiBase);
} catch {
  errors.push(`Resolved API base is not a valid URL: ${apiBase}`);
}

try {
  new URL(uploadUrl);
} catch {
  errors.push(`Resolved upload URL is not a valid URL: ${uploadUrl}`);
}

if (releaseProfiles.has(profile) && embeddedToken) {
  errors.push('EXPO_PUBLIC_API_TOKEN must be empty for store builds.');
}

if (errors.length > 0) {
  console.error(`Release validation failed for profile "${profile}".`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Release validation passed for profile "${profile}".`);
console.log(`App version: ${pkg.version}`);
console.log('Release versioning: EAS remote auto-increment');
console.log(`API base: ${apiBase}`);
console.log(`Upload URL: ${uploadUrl}`);
