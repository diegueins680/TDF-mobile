const path = require('node:path');
const evidence = process.env.TDF_UI_EVIDENCE;
if (!evidence) throw new Error('TDF_UI_EVIDENCE must name the evidence directory');
/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: { config: 'e2e/ci/jest.config.js', json: true, outputFile: path.join(evidence, 'jest.json') },
    jest: { setupTimeout: 180000 },
  },
  apps: {
    ios: { type: 'ios.app', binaryPath: process.env.TDF_UI_APP },
    android: {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk',
    },
  },
  devices: {
    ios: { type: 'ios.simulator', device: { id: process.env.TDF_UI_DEVICE } },
    android: { type: 'android.attached', device: { adbName: 'emulator-5554' } },
  },
  configurations: {
    'ci.ios': { device: 'ios', app: 'ios' },
    'ci.android': { device: 'android', app: 'android' },
  },
  artifacts: {
    rootDir: path.join(evidence, 'detox'),
    plugins: {
      screenshot: { enabled: true, takeWhen: { testStart: false, testDone: true } },
      log: { enabled: true },
    },
  },
};
