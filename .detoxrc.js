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
        id: '8DB9DCE0-2F80-49C9-A614-F21DA3876B7B', // fresh iPhone 16 post-host-restart; prior 3C3D5759 corrupted by simctl hangs
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
