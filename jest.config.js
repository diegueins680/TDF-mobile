const path = require('path');
const expoPreset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */

module.exports = {
  ...expoPreset,
  rootDir: '.',
  modulePaths: [path.resolve(__dirname, '../node_modules')],
  setupFiles: ['<rootDir>/jest.installGlobal.setup.js', ...(expoPreset.setupFiles ?? [])],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
};
