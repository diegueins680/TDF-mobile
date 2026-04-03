#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';

const requiredEnv = [
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  'GOOGLE_IOS_URL_SCHEME',
];

// Load base env first, then let local overrides win (matching common Expo/.env expectations).
const candidateEnvFiles = ['.env', '.env.local'];
const searchedSources = ['process.env', ...candidateEnvFiles.slice().reverse()];

const readEnvFile = (relativePath) => {
  if (!existsSync(new URL(`../${relativePath}`, import.meta.url))) {
    return {};
  }

  const contents = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
  const values = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const name = line.slice(0, equalsIndex).trim();
    const rawValue = line.slice(equalsIndex + 1).trim();
    const unwrappedValue = rawValue.replace(/^("|')(.*)\1$/u, '$2').trim();

    values[name] = unwrappedValue;
  }

  return values;
};

const envByFile = Object.fromEntries(
  candidateEnvFiles.map((file) => [file, readEnvFile(file)]),
);

const misleadingAliasPairs = [
  {
    canonical: 'GOOGLE_IOS_URL_SCHEME',
    alias: 'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME',
    reason: 'app.config.ts only reads GOOGLE_IOS_URL_SCHEME during native plugin setup',
  },
];

const resolveEntry = (name) => {
  const processValue = process.env[name]?.trim();
  if (processValue) {
    return { name, value: processValue, source: 'process.env' };
  }

  for (const file of candidateEnvFiles.slice().reverse()) {
    const fileValue = envByFile[file]?.[name]?.trim();
    if (fileValue) {
      return { name, value: fileValue, source: file };
    }
  }

  return { name, value: '', source: '' };
};

const resolvedEntries = requiredEnv.map(resolveEntry);
const resolvedMap = Object.fromEntries(
  resolvedEntries.map(({ name, value }) => [name, value]),
);
const googleClientIdSuffix = '.apps.googleusercontent.com';
const derivedGoogleIosUrlScheme = (() => {
  const iosClientId = resolvedMap.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!iosClientId || !iosClientId.endsWith(googleClientIdSuffix)) {
    return '';
  }

  const clientIdPrefix = iosClientId.slice(0, -googleClientIdSuffix.length);
  return clientIdPrefix ? `com.googleusercontent.apps.${clientIdPrefix}` : '';
})();

const validators = {
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: (value) =>
    value.endsWith(googleClientIdSuffix)
      ? undefined
      : 'must end with .apps.googleusercontent.com',
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: (value) =>
    value.endsWith(googleClientIdSuffix)
      ? undefined
      : 'must end with .apps.googleusercontent.com',
  GOOGLE_IOS_URL_SCHEME: (value) => {
    if (!/^com\.googleusercontent\.apps\.[A-Za-z0-9._-]+$/u.test(value)) {
      return 'must look like a reversed Google iOS client ID scheme (for example com.googleusercontent.apps.1234567890-abcdef)';
    }

    if (derivedGoogleIosUrlScheme && value !== derivedGoogleIosUrlScheme) {
      return `must exactly match reversed EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (${derivedGoogleIosUrlScheme})`;
    }

    return undefined;
  },
};

const missing = resolvedEntries.filter(({ value }) => !value).map(({ name }) => name);
const invalid = resolvedEntries
  .filter(({ value }) => Boolean(value))
  .map(({ name, value }) => {
    const validator = validators[name];
    const validationError = validator ? validator(value) : undefined;
    return validationError ? `${name}: ${validationError}` : undefined;
  })
  .filter(Boolean);
const misleadingAliases = misleadingAliasPairs
  .map(({ canonical, alias, reason }) => {
    const aliasEntry = resolveEntry(alias);
    if (!aliasEntry.value) {
      return undefined;
    }

    const canonicalValue = resolvedMap[canonical];
    if (!canonicalValue) {
      return `${alias}: found in ${aliasEntry.source} but ignored for native plugin setup; set ${canonical} instead because ${reason}`;
    }

    if (canonicalValue !== aliasEntry.value) {
      return `${alias}: value from ${aliasEntry.source} does not match ${canonical}; keep only ${canonical} or make both values identical because ${reason}`;
    }

    return undefined;
  })
  .filter(Boolean);

const printResolvedStatus = (writeLine) => {
  writeLine('Resolved native Google proof input status:');
  resolvedEntries.forEach(({ name, value, source }) => {
    if (value) {
      writeLine(`- ${name}=available (source=${source}, value=${JSON.stringify(value)})`);
      return;
    }

    writeLine(`- ${name}=missing (checked ${searchedSources.join(', ')})`);
  });

  if (derivedGoogleIosUrlScheme) {
    writeLine(`- expected GOOGLE_IOS_URL_SCHEME=${derivedGoogleIosUrlScheme} (derived from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID)`);
  }
};

if (missing.length > 0 || invalid.length > 0 || misleadingAliases.length > 0) {
  console.error('Google Sign-In env check failed.');
  printResolvedStatus(console.error);

  if (missing.length > 0) {
    console.error('Missing native Google proof inputs:');
    missing.forEach((name) => console.error(`- ${name}`));
  }

  if (invalid.length > 0) {
    console.error('Invalid native Google proof inputs:');
    invalid.forEach((message) => console.error(`- ${message}`));
  }

  if (misleadingAliases.length > 0) {
    console.error('Misleading native Google env aliases:');
    misleadingAliases.forEach((message) => console.error(`- ${message}`));
  }

  console.error('Expected sources: exported shell env, tdf-mobile/.env.local, or tdf-mobile/.env.');
  console.error('Reference template: tdf-mobile/.env.example');
  process.exit(1);
}

console.log('Google Sign-In env check passed.');
printResolvedStatus(console.log);
