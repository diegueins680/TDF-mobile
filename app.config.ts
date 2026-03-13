import type { ExpoConfig } from 'expo/config';
import pkg from './package.json';

const APP_NAME = 'TDF Records';
const APP_DESCRIPTION =
  'Mobile workspace for TDF Records teams to manage parties, bookings, events, venues, inventory, and vCard exchanges.';
const APP_SLUG = 'tdf-mobile';
const APP_SCHEME = 'tdf';
const IOS_BUNDLE_IDENTIFIER = 'com.tdf.records';
const ANDROID_PACKAGE = 'com.tdf.records';
const DEFAULT_TIME_ZONE = 'America/Guayaquil';
const BRAND_BACKGROUND = '#0b1724';
const CAMERA_PERMISSION =
  'Allow TDF Records to use your camera to scan vCards and capture inventory photos.';
const PHOTOS_PERMISSION =
  'Allow TDF Records to access your photo library so you can attach inventory images.';
const LOCATION_PERMISSION =
  'Allow TDF Records to access your location to find nearby venues.';

const normalizeEnv = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const parseBuildNumber = (value: string | undefined, fallback: string) => {
  const trimmed = normalizeEnv(value);
  if (!trimmed) return fallback;
  if (!/^\d+$/.test(trimmed) || Number.parseInt(trimmed, 10) < 1) {
    throw new Error('IOS_BUILD_NUMBER must be a positive integer string.');
  }
  return trimmed;
};

const parseVersionCode = (value: string | undefined, fallback: number) => {
  const trimmed = normalizeEnv(value);
  if (!trimmed) return fallback;
  if (!/^\d+$/.test(trimmed)) {
    throw new Error('ANDROID_VERSION_CODE must be a positive integer.');
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (parsed < 1) {
    throw new Error('ANDROID_VERSION_CODE must be greater than zero.');
  }
  return parsed;
};

const currentProfile = normalizeEnv(process.env.EAS_BUILD_PROFILE) ?? 'development';
const isReleaseProfile = currentProfile === 'preview' || currentProfile === 'production';

const apiBase = normalizeEnv(process.env.EXPO_PUBLIC_API_BASE);
const uploadUrl = normalizeEnv(process.env.EXPO_PUBLIC_UPLOAD_URL);
const defaultTimeZone = normalizeEnv(process.env.EXPO_PUBLIC_TZ) ?? DEFAULT_TIME_ZONE;
const embeddedApiToken = normalizeEnv(process.env.EXPO_PUBLIC_API_TOKEN);
const iosBuildNumber = parseBuildNumber(process.env.IOS_BUILD_NUMBER, '1');
const androidVersionCode = parseVersionCode(process.env.ANDROID_VERSION_CODE, 1);

if (isReleaseProfile) {
  const missing: string[] = [];
  if (!apiBase) missing.push('EXPO_PUBLIC_API_BASE');
  if (!uploadUrl) missing.push('EXPO_PUBLIC_UPLOAD_URL');
  if (missing.length > 0) {
    throw new Error(
      `Missing required release environment variables for ${currentProfile}: ${missing.join(', ')}`
    );
  }
  if (embeddedApiToken) {
    throw new Error(
      'EXPO_PUBLIC_API_TOKEN must not be embedded in preview or production builds. Use the in-app auth screen instead.'
    );
  }
}

const config: ExpoConfig = {
  name: APP_NAME,
  slug: APP_SLUG,
  description: APP_DESCRIPTION,
  version: pkg.version,
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  scheme: APP_SCHEME,
  icon: './assets/app-icon.png',
  runtimeVersion: {
    policy: 'appVersion'
  },
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: BRAND_BACKGROUND
  },
  ios: {
    bundleIdentifier: IOS_BUNDLE_IDENTIFIER,
    buildNumber: iosBuildNumber,
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false
    }
  },
  android: {
    package: ANDROID_PACKAGE,
    versionCode: androidVersionCode,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: BRAND_BACKGROUND
    }
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png'
  },
  plugins: [
    'expo-router',
    [
      'expo-image-picker',
      {
        cameraPermission: CAMERA_PERMISSION,
        photosPermission: PHOTOS_PERMISSION
      }
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: LOCATION_PERMISSION
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    apiBase: apiBase ?? null,
    uploadUrl: uploadUrl ?? null,
    appEnvironment: currentProfile,
    defaultTimeZone,
    eas: {
      projectId: '218aca4d-c096-4892-a353-c1dd7df23448'
    }
  }
};

export default config;
