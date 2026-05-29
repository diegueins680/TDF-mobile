module.exports = {
  testRunner: {
    args: {
      config: 'e2e/jest.config.js',
      _: ['e2e'],
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.sim.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/TDFRecords.app',
      build: 'xcodebuild -workspace ios/TDFRecords.xcworkspace -scheme TDFRecords -configuration Debug -sdk iphonesimulator -destination "platform=iOS Simulator,name=iPhone 16" -derivedDataPath ios/build',
    },
    'ios.sim.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/TDFRecords.app',
      build: 'xcodebuild -workspace ios/TDFRecords.xcworkspace -scheme TDFRecords -configuration Release -sdk iphonesimulator -destination "platform=iOS Simulator,name=iPhone 16" -derivedDataPath ios/build',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        id: '525DA785-50A3-4AAD-AECC-AB33F54DEC6E', // iPhone 16-Detox2 — created 2026-05-29 after 8DB9DCE0 entered persistent simctl install hang (~30h post-reboot pattern)
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.sim.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.sim.release',
    },
  },
  artifacts: {
    rootDir: 'artifacts',
    plugins: {
      screenshot: {
        enabled: true,
        takeWhen: {
          testStart: false,
          testDone: true,
        },
      },
    },
  },
};
