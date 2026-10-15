const path = require('path');
const expoPreset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */

module.exports = {
  ...expoPreset,
  // The CommonJS compatibility adapter consumes upstream's patched ES module.
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map(pattern =>
    pattern.replace('/node_modules/(?!(', '/node_modules/(?!(decode-uri-component-upstream|')
  ),
  rootDir: '.',
  modulePaths: [path.resolve(__dirname, '../node_modules')],
  setupFiles: ['<rootDir>/jest.installGlobal.setup.js', ...(expoPreset.setupFiles ?? [])],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
};
