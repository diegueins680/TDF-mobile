import 'dotenv/config';
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'TDF Records',
  slug: 'tdf-mobile',
  scheme: 'tdf',
  ios: { supportsTablet: false },
  android: { package: 'com.tdf.records' },
  experiments: { typedRoutes: true }, // plays nice with Expo Router v6
  extra: {
    EXPO_PUBLIC_API_BASE:
      process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:8080'
  }
};

export default config;
