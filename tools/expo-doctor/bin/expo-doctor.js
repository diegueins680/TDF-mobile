#!/usr/bin/env node

const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = process.cwd();
const CONFIG_PATH = resolve(ROOT, 'tools/expo-doctor/config.json');
const PACKAGE_JSON_PATH = resolve(ROOT, 'package.json');
const LOCKFILE_PATH = resolve(ROOT, 'package-lock.json');

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) {
    throw new Error(`Unsupported semver value: ${version}`);
  }

  return match.slice(1).map((value) => Number.parseInt(value, 10));
}

function compareVersions(left, right) {
  const [leftMajor, leftMinor, leftPatch] = parseVersion(left);
  const [rightMajor, rightMinor, rightPatch] = parseVersion(right);

  if (leftMajor !== rightMajor) {
    return leftMajor - rightMajor;
  }

  if (leftMinor !== rightMinor) {
    return leftMinor - rightMinor;
  }

  return leftPatch - rightPatch;
}

function satisfies(version, range) {
  const normalizedRange = range.trim();

  if (normalizedRange === '*') {
    return true;
  }

  if (normalizedRange.startsWith('~')) {
    const base = normalizedRange.slice(1);
    const [major, minor] = parseVersion(base);
    const [actualMajor, actualMinor] = parseVersion(version);
    return actualMajor === major && actualMinor === minor && compareVersions(version, base) >= 0;
  }

  if (normalizedRange.startsWith('^')) {
    const base = normalizedRange.slice(1);
    const [major, minor, patch] = parseVersion(base);
    const [actualMajor, actualMinor, actualPatch] = parseVersion(version);

    if (major > 0) {
      return actualMajor === major && compareVersions(version, base) >= 0;
    }

    if (minor > 0) {
      return actualMajor === 0 && actualMinor === minor && compareVersions(version, base) >= 0;
    }

    return actualMajor === 0 && actualMinor === 0 && actualPatch >= patch;
  }

  if (normalizedRange.startsWith('>=')) {
    const base = normalizedRange.slice(2).trim();
    return compareVersions(version, base) >= 0;
  }

  return compareVersions(version, normalizedRange) === 0;
}

function packageVersion(lockfile, packageName) {
  return lockfile.packages[`node_modules/${packageName}`]?.version ?? null;
}

function duplicateNativeModules(lockfile, rootDependencies) {
  const duplicates = new Map();
  const trackedPackages = new Set(
    Object.keys(rootDependencies).filter(
      (packageName) => packageName.startsWith('expo-') || packageName.startsWith('react-native-'),
    ),
  );

  trackedPackages.add('@react-native-async-storage/async-storage');

  for (const [packagePath, details] of Object.entries(lockfile.packages)) {
    if (!packagePath.startsWith('node_modules/')) {
      continue;
    }

    const packageName = packagePath.replace(/^node_modules\//, '').split('/node_modules/').pop();
    if (!trackedPackages.has(packageName)) {
      continue;
    }

    const versions = duplicates.get(packageName) ?? new Set();
    versions.add(details.version);
    duplicates.set(packageName, versions);
  }

  return [...duplicates.entries()]
    .filter(([, versions]) => versions.size > 1)
    .map(([packageName, versions]) => ({
      packageName,
      versions: [...versions].sort(),
    }));
}

function main() {
  if (!existsSync(PACKAGE_JSON_PATH) || !existsSync(LOCKFILE_PATH) || !existsSync(CONFIG_PATH)) {
    console.error('expo-doctor must be run from the repository root after `npm ci`.');
    process.exit(1);
  }

  const packageJson = loadJson(PACKAGE_JSON_PATH);
  const lockfile = loadJson(LOCKFILE_PATH);
  const config = loadJson(CONFIG_PATH);
  const bundledNativeModules = require(resolve(ROOT, 'node_modules/expo/bundledNativeModules.json'));

  const rootDependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };

  const errors = [];
  const warnings = [];

  for (const [packageName, requiredDependencies] of Object.entries(config.requiredDirectDependencies ?? {})) {
    if (!rootDependencies[packageName]) {
      continue;
    }

    for (const dependencyName of requiredDependencies) {
      if (!rootDependencies[dependencyName]) {
        errors.push(`${packageName} requires a direct ${dependencyName} dependency in package.json.`);
      }
    }
  }

  for (const duplicate of duplicateNativeModules(lockfile, rootDependencies)) {
    errors.push(
      `Duplicate native module ${duplicate.packageName} detected with versions ${duplicate.versions.join(', ')}.`,
    );
  }

  for (const [packageName, recommendedRange] of Object.entries(bundledNativeModules)) {
    if (!rootDependencies[packageName]) {
      continue;
    }

    const installedVersion = packageVersion(lockfile, packageName);
    if (!installedVersion || satisfies(installedVersion, recommendedRange)) {
      continue;
    }

    const reason = config.allowedVersionWarnings?.[packageName];
    const message = `${packageName}@${installedVersion} does not satisfy Expo SDK recommendation ${recommendedRange}.`;

    if (reason) {
      warnings.push(`${message} ${reason}`);
      continue;
    }

    errors.push(message);
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('expo-doctor passed with no release-blocking findings.');
    return;
  }

  if (errors.length > 0) {
    console.error('expo-doctor found release-blocking issues:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
  }

  if (warnings.length > 0) {
    const printer = errors.length > 0 ? console.error : console.warn;
    printer('expo-doctor warnings:');
    for (const warning of warnings) {
      printer(`- ${warning}`);
    }
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
