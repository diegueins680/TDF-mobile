const path = require('path');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  moduleDirectories: ['node_modules', path.join(__dirname, 'node_modules')],
  moduleNameMapper: {
    '^react$': path.join(__dirname, 'node_modules/react'),
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|@expo|expo(nent)?|@expo-google-fonts|@unimodules|unimodules|sentry-expo|native-base|react-clone-referenced-element)',
  ],
};
