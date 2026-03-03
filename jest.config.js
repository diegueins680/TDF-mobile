/** @type {import('jest').Config} */
const path = require('path');

function resolveModule(specifier) {
  const searchPaths = [__dirname, path.join(__dirname, '..')];

  try {
    return require.resolve(specifier, { paths: searchPaths });
  } catch {
    return specifier;
  }
}

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|@expo|expo(nent)?|@expo-google-fonts|@unimodules|unimodules|sentry-expo|native-base|react-clone-referenced-element)',
  ],
  moduleNameMapper: {
    '^react$': resolveModule('react'),
    '^react/jsx-runtime$': resolveModule('react/jsx-runtime'),
    '^react/jsx-dev-runtime$': resolveModule('react/jsx-dev-runtime'),
  },
};
