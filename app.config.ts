import 'dotenv/config';
import { ExpoConfig } from 'expo/config';

export default ({ config }: { config: ExpoConfig }) => ({
  ...config,
  name: 'TDF Records',
  slug: 'tdf-mobile',
  scheme: 'tdf',
  ios: { supportsTablet: false },
  android: { package: 'com.tdf.records' },
  experiments: { ...(config.experiments ?? {}), typedRoutes: true }, // plays nice with Expo Router v6
  extra: {
    ...(config.extra ?? {}),
    apiBase: process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8080'
  }
});
