/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const BUILTIN_SYMBOL = Symbol.for('expo.builtin');

const markExpoBuiltin = (value) => {
  if ((typeof value !== 'object' || value === null) && typeof value !== 'function') {
    return value;
  }

  Object.defineProperty(value, BUILTIN_SYMBOL, {
    value: true,
    enumerable: false,
    configurable: false,
  });

  return value;
};

// Expo 54 installs WinterCG globals through lazy getters. Under the Jest 30 runtime
// those getters can violate the "active test scope" invariant when they `require()`
// another module later, so we eagerly resolve each global once during setup.
jest.mock('expo/src/winter/installGlobal', () => ({
  __esModule: true,
  installGlobal(name, getValue) {
    const target = typeof global !== 'undefined' ? global : globalThis;
    if (Object.getOwnPropertyDescriptor(target, name)) {
      return;
    }

    const value = markExpoBuiltin(getValue());
    Object.defineProperty(target, name, {
      value,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  },
}));
