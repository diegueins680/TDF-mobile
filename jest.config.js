const path = require('path');

/** @type {import('jest').Config} */

module.exports = {
  preset: 'jest-expo',
  rootDir: '.',
  modulePaths: [path.resolve(__dirname, '../node_modules')],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
};
