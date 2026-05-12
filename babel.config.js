const canResolveWorkletsPlugin = () => {
  try {
    require.resolve('react-native-worklets/plugin');
    return true;
  } catch {
    return false;
  }
};

module.exports = function (api) {
  const env = api.env();
  api.cache.using(() => env);
  const isTestEnv = env === 'test' || process.env.JEST_WORKER_ID !== undefined;
  const plugins = [];

  // Jest does not exercise worklets here; skip the plugin when the test install lacks it.
  if (!isTestEnv || canResolveWorkletsPlugin()) {
    plugins.push('react-native-reanimated/plugin');
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
