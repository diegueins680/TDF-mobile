import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'TDF Records',
  slug: 'tdf-mobile',
  scheme: 'tdf',
  ios: { supportsTablet: false },
  android: { package: 'com.tdf.records' },
  experiments: { typedRoutes: true } // plays nice with Expo Router v6
};

export default config;
