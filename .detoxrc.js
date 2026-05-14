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
      binaryPath: '/Users/diegosaa/.openclaw/tmp/eas-cli-nodejs/eas-build-run-cache/218aca4d-c096-4892-a353-c1dd7df23448_8d91fabe-a01c-41d1-bc6b-b55dc9c689e9.app',
      build: 'echo "Using pre-built EAS artifact; no local build required."',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        id: '3C3D5759-6E10-480D-B768-2747B9B0D02A', // primary test device — do not change; other simulators experience simctl hangs
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
