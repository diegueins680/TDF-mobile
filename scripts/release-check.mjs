#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const profile = (process.env.EAS_BUILD_PROFILE ?? 'production').trim() || 'production';
const releaseProfiles = new Set(['preview', 'production']);
const localApiBase = 'http://localhost:8080';
const localUploadUrl = `${localApiBase}/drive/upload`;
const releaseApiBase = 'https://tdf-hq.fly.dev';
const releaseUploadUrl = `${releaseApiBase}/drive/upload`;
const canonicalBundleId = 'com.tdfrecords.app';
const staleBundleId = 'com.tdf.records';
const canonicalSlug = 'tdf-mobile';
const canonicalOwner = 'cuco.saa';
const canonicalEasProjectId = '218aca4d-c096-4892-a353-c1dd7df23448';

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

const readRepoFile = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const embeddedToken = readEnv('EXPO_PUBLIC_API_TOKEN');
const apiBase = resolveReleaseAwareEnv('EXPO_PUBLIC_API_BASE', releaseApiBase, localApiBase);
const uploadUrl = resolveReleaseAwareEnv('EXPO_PUBLIC_UPLOAD_URL', releaseUploadUrl, localUploadUrl);

const errors = [];
const disallowedScannerDependency = 'expo-barcode-scanner';
const dependencySources = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const releaseIdentityChecks = [
  {
    path: 'app.config.ts',
    requiredSnippets: [
      `const APP_SLUG = '${canonicalSlug}';`,
      `const BUNDLE_ID = '${canonicalBundleId}';`,
      `const DEFAULT_EAS_PROJECT_ID = '${canonicalEasProjectId}';`,
      'runtimeVersion: APP_VERSION,',
      'bundleIdentifier: BUNDLE_ID,',
      'package: BUNDLE_ID,',
      'projectId: EAS_PROJECT_ID',
    ],
    forbiddenSnippets: [staleBundleId],
  },
  {
    path: 'app.json',
    requiredSnippets: [
      `"slug": "${canonicalSlug}"`,
      `"owner": "${canonicalOwner}"`,
      `"projectId": "${canonicalEasProjectId}"`,
      `"package": "${canonicalBundleId}"`,
      `"bundleIdentifier": "${canonicalBundleId}"`,
    ],
    forbiddenSnippets: [staleBundleId],
  },
  {
    path: 'ios/TDFRecords.xcodeproj/project.pbxproj',
    requiredPatterns: [
      new RegExp(`PRODUCT_BUNDLE_IDENTIFIER = "?${canonicalBundleId.replaceAll('.', '\\.')}"?;`),
    ],
    forbiddenSnippets: [staleBundleId],
  },
  {
    path: 'ios/TDFRecords/Info.plist',
    requiredSnippets: [canonicalBundleId],
    forbiddenSnippets: [staleBundleId],
  },
  {
    path: 'android/app/build.gradle',
    requiredSnippets: [
      `namespace '${canonicalBundleId}'`,
      `applicationId '${canonicalBundleId}'`,
    ],
    forbiddenSnippets: [staleBundleId],
  },
  {
    path: 'android/app/src/main/java/com/tdfrecords/app/MainActivity.kt',
    requiredSnippets: [`package ${canonicalBundleId}`],
    forbiddenSnippets: [staleBundleId],
  },
  {
    path: 'android/app/src/main/java/com/tdfrecords/app/MainApplication.kt',
    requiredSnippets: [`package ${canonicalBundleId}`],
    forbiddenSnippets: [staleBundleId],
  },
];

for (const source of dependencySources) {
  if (pkg[source]?.[disallowedScannerDependency]) {
    errors.push(
      `${disallowedScannerDependency} is present in package.json ${source}; keep QR scanning on expo-camera to avoid regressing the current release path.`,
    );
  }
}

for (const check of releaseIdentityChecks) {
  let contents = '';

  try {
    contents = readRepoFile(check.path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Unable to read ${check.path}: ${message}`);
    continue;
  }

  for (const snippet of check.requiredSnippets ?? []) {
    if (!contents.includes(snippet)) {
      errors.push(`${check.path} is missing canonical release identity evidence: ${snippet}`);
    }
  }

  for (const pattern of check.requiredPatterns ?? []) {
    if (!pattern.test(contents)) {
      errors.push(`${check.path} is missing canonical release identity evidence: ${pattern}`);
    }
  }

  for (const snippet of check.forbiddenSnippets) {
    if (contents.includes(snippet)) {
      errors.push(`${check.path} still contains stale release identity: ${snippet}`);
    }
  }
}

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
console.log(`Canonical bundle/application ID: ${canonicalBundleId}`);
console.log(`Canonical Expo owner/slug: @${canonicalOwner}/${canonicalSlug}`);
console.log(`Canonical EAS project ID: ${canonicalEasProjectId}`);
console.log(`API base: ${apiBase}`);
console.log(`Upload URL: ${uploadUrl}`);
