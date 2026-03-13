import { ExpoConfig } from 'expo/config';

const APP_VERSION = '1.0.0';
const IOS_BUILD_NUMBER = process.env.IOS_BUILD_NUMBER ?? '1';
const parsedAndroidVersionCode = Number.parseInt(process.env.ANDROID_VERSION_CODE ?? '1', 10);
const ANDROID_VERSION_CODE = Number.isFinite(parsedAndroidVersionCode) && parsedAndroidVersionCode > 0
  ? parsedAndroidVersionCode
  : 1;
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID?.trim();

export default ({ config }: { config: ExpoConfig }) => ({
  ...config,
  name: 'TDF Records',
  slug: 'tdf-mobile',
  version: APP_VERSION,
  scheme: 'tdf',
  icon: './assets/release/icon.png',
  description: 'Mobile operations workspace for TDF Records teams handling bookings, events, contacts, inventory, and venues.',
  splash: {
    image: './assets/release/splash-logo.png',
    resizeMode: 'contain',
    backgroundColor: '#0b1220'
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.tdf.records',
    buildNumber: IOS_BUILD_NUMBER,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: 'TDF Records uses the camera to scan vCard QR codes and capture inventory photos.',
      NSLocationWhenInUseUsageDescription: 'TDF Records uses your location to show nearby venues.',
      NSPhotoLibraryUsageDescription: 'TDF Records uses your photo library so you can attach inventory photos.'
    }
  },
  android: {
    package: 'com.tdf.records',
    versionCode: ANDROID_VERSION_CODE,
    adaptiveIcon: {
      foregroundImage: './assets/release/adaptive-icon.png',
      monochromeImage: './assets/release/adaptive-monochrome.png',
      backgroundColor: '#0b1220'
    },
    permissions: [
      'CAMERA',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION'
    ]
  },
  web: {
    favicon: './assets/release/favicon.png'
  },
  runtimeVersion: {
    policy: 'appVersion'
  },
  plugins: [
    'expo-router',
    'expo-camera'
  ],
  experiments: { ...(config.experiments ?? {}), typedRoutes: true },
  extra: {
    ...(config.extra ?? {}),
    apiBase: process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8080',
    ...(EAS_PROJECT_ID
      ? {
          eas: {
            projectId: EAS_PROJECT_ID
          }
        }
      : {})
  }
});
