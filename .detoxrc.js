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
      binaryPath: '/tmp/TDFRecords-derived/Build/Products/Debug-iphonesimulator/TDFRecords.app',
      build: 'xcodebuild -workspace ios/TDFRecords.xcworkspace -scheme TDFRecords -configuration Debug -sdk iphonesimulator -derivedDataPath /tmp/TDFRecords-derived',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 16',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.sim.debug',
    },
  },
};
