import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')) as { version: string };

const APP_NAME = 'TDF Records';
const APP_SLUG = 'tdf-mobile';
const APP_SCHEME = 'tdf';
const APP_VERSION = packageJson.version;
const BUNDLE_ID = 'com.tdfrecords.app';
const PUBLIC_SITE_URL = 'https://tdf-app.pages.dev/mobile-app';
const PUBLIC_SUPPORT_URL = `${PUBLIC_SITE_URL}/support.html`;
const PUBLIC_PRIVACY_POLICY_URL = `${PUBLIC_SITE_URL}/privacy.html`;
const PUBLIC_TERMS_OF_SERVICE_URL = `${PUBLIC_SITE_URL}/terms.html`;
const PUBLIC_DATA_DELETION_URL = `${PUBLIC_SITE_URL}/data-deletion.html`;
const SUPPORT_EMAIL = 'soporte@tdfrecords.com';
const BRAND_BACKGROUND = '#0f172a';
const LOCAL_API_BASE = 'http://localhost:8080';
const LOCAL_UPLOAD_URL = `${LOCAL_API_BASE}/drive/upload`;
const RELEASE_API_BASE = 'https://the-dream-factory.koyeb.app';
const RELEASE_UPLOAD_URL = `${RELEASE_API_BASE}/drive/upload`;
const RELEASE_BUILD_PROFILES = new Set(['preview', 'production']);
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
const EAS_BUILD_PROFILE = process.env.EAS_BUILD_PROFILE?.trim();

const resolveReleaseAwareEnv = (name: 'EXPO_PUBLIC_API_BASE' | 'EXPO_PUBLIC_UPLOAD_URL', releaseValue: string, localValue: string) => {
  const explicitValue = process.env[name]?.trim();
  if (explicitValue) {
    return explicitValue;
  }

  return EAS_BUILD_PROFILE && RELEASE_BUILD_PROFILES.has(EAS_BUILD_PROFILE) ? releaseValue : localValue;
};

// EAS profile envs should normally populate these values, but keep release config
// resolvable even when app.config is evaluated before profile env injection.
const API_BASE = resolveReleaseAwareEnv('EXPO_PUBLIC_API_BASE', RELEASE_API_BASE, LOCAL_API_BASE);
const UPLOAD_URL = resolveReleaseAwareEnv('EXPO_PUBLIC_UPLOAD_URL', RELEASE_UPLOAD_URL, LOCAL_UPLOAD_URL);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: APP_SLUG,
  scheme: APP_SCHEME,
  version: APP_VERSION,
  description: 'TDF Records mobile app for bookings, events, venues, inventory, pipelines, and social tools.',
  icon: './assets/icon.png',
  runtimeVersion: {
    policy: 'appVersion'
  },
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: BRAND_BACKGROUND
  },
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    config: {
      usesNonExemptEncryption: false
    }
  },
  android: {
    package: BUNDLE_ID,
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      backgroundColor: BRAND_BACKGROUND
    }
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png'
  },
  plugins: [
    'expo-router',
    [
      'expo-barcode-scanner',
      {
        cameraPermission: 'Allow TDF Records to use your camera to scan QR codes and capture inventory images.',
        microphonePermission: false
      }
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow TDF Records to access your photos so you can attach inventory images.',
        cameraPermission: 'Allow TDF Records to use your camera to scan QR codes and capture inventory images.'
      }
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        locationWhenInUsePermission: 'Allow TDF Records to use your location to show nearby venues.'
      }
    ]
  ],
  experiments: {
    ...(config.experiments ?? {}),
    typedRoutes: true
  },
  extra: {
    ...(config.extra ?? {}),
    apiBase: API_BASE,
    uploadUrl: UPLOAD_URL,
    supportEmail: SUPPORT_EMAIL,
    urls: {
      support: PUBLIC_SUPPORT_URL,
      privacyPolicy: PUBLIC_PRIVACY_POLICY_URL,
      termsOfService: PUBLIC_TERMS_OF_SERVICE_URL,
      dataDeletion: PUBLIC_DATA_DELETION_URL
    },
    ...(EAS_PROJECT_ID
      ? {
          eas: {
            projectId: EAS_PROJECT_ID
          }
        }
      : {})
  }
});
