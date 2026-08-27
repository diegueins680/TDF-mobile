import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { withDangerousMod, type ConfigPlugin } from '@expo/config-plugins';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_NAME = 'TDF Records';
const APP_SLUG = 'tdf-mobile';
const APP_SCHEME = 'tdf';
const APP_VERSION = process.env.APP_VERSION?.trim() || '1.0.1';
const ANDROID_VERSION_CODE = Number.parseInt(process.env.ANDROID_VERSION_CODE?.trim() || '8', 10);
const IOS_BUNDLE_ID = 'com.tdfrecords.app';
const ANDROID_PACKAGE = 'com.tdf.records';
const DEFAULT_TIME_ZONE = 'America/Guayaquil';
const PUBLIC_SITE_URL = 'https://tdf-app.pages.dev/mobile-app';
const PUBLIC_SUPPORT_URL = `${PUBLIC_SITE_URL}/support.html`;
const PUBLIC_PRIVACY_POLICY_URL = `${PUBLIC_SITE_URL}/privacy.html`;
const PUBLIC_TERMS_OF_SERVICE_URL = `${PUBLIC_SITE_URL}/terms.html`;
const PUBLIC_DATA_DELETION_URL = `${PUBLIC_SITE_URL}/data-deletion.html`;
const SUPPORT_EMAIL = 'soporte@tdfrecords.com';
const BRAND_BACKGROUND = '#0f172a';
const LOCAL_API_BASE = 'http://localhost:8080';
const LOCAL_UPLOAD_URL = `${LOCAL_API_BASE}/drive/upload`;
const RELEASE_API_BASE = 'https://tdf-hq.fly.dev';
const RELEASE_UPLOAD_URL = `${RELEASE_API_BASE}/drive/upload`;
const RELEASE_BUILD_PROFILES = new Set(['preview', 'production']);
const DEFAULT_EAS_PROJECT_ID = '218aca4d-c096-4892-a353-c1dd7df23448';
const EAS_PROJECT_ID =
  process.env.EAS_PROJECT_ID ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? DEFAULT_EAS_PROJECT_ID;
const EAS_BUILD_PROFILE = process.env.EAS_BUILD_PROFILE?.trim() || 'development';
const DEFAULT_TZ = process.env.EXPO_PUBLIC_TZ?.trim() || DEFAULT_TIME_ZONE;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const GOOGLE_IOS_URL_SCHEME =
  process.env.GOOGLE_IOS_URL_SCHEME?.trim() || process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
const STRIPE_MERCHANT_IDENTIFIER =
  process.env.STRIPE_MERCHANT_IDENTIFIER?.trim() || process.env.EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER?.trim();

const resolveReleaseAwareEnv = (name: 'EXPO_PUBLIC_API_BASE' | 'EXPO_PUBLIC_UPLOAD_URL', releaseValue: string, localValue: string) => {
  const explicitValue = process.env[name]?.trim();
  if (explicitValue) {
    return explicitValue;
  }

  return RELEASE_BUILD_PROFILES.has(EAS_BUILD_PROFILE) ? releaseValue : localValue;
};

// EAS profile envs should normally populate these values, but keep release config
// resolvable even when app.config is evaluated before profile env injection.
const API_BASE = resolveReleaseAwareEnv('EXPO_PUBLIC_API_BASE', RELEASE_API_BASE, LOCAL_API_BASE);
const UPLOAD_URL = resolveReleaseAwareEnv('EXPO_PUBLIC_UPLOAD_URL', RELEASE_UPLOAD_URL, LOCAL_UPLOAD_URL);

const withGoogleSigninModularHeaders: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, 'Podfile');
      const podfile = await fs.promises.readFile(podfilePath, 'utf8');
      if (podfile.includes('use_modular_headers!')) {
        return modConfig;
      }

      const updatedPodfile = podfile.replace(
        /(platform :ios, podfile_properties\['ios\.deploymentTarget'\] \|\| '[^']+'\n)/,
        '$1use_modular_headers!\n',
      );
      await fs.promises.writeFile(podfilePath, updatedPodfile);
      return modConfig;
    },
  ]);
const withGoogleSigninModularHeadersPlugin =
  withGoogleSigninModularHeaders as unknown as NonNullable<ExpoConfig['plugins']>[number];

const plugins: NonNullable<ExpoConfig['plugins']> = [
  'expo-router',
  'expo-secure-store',
  [
    'expo-notifications',
    {
      defaultChannel: 'operations',
      sounds: []
    }
  ],
  'expo-localization',
  withGoogleSigninModularHeadersPlugin,
  [
    'expo-camera',
    {
      cameraPermission: 'Allow TDF Records to use your camera to scan vCard QR codes, capture inventory images, and broadcast live video.',
      microphonePermission: 'Allow TDF Records to use your microphone for fanclub live broadcasts.'
    }
  ],
  [
    'expo-image-picker',
    {
      photosPermission: 'Allow TDF Records to access your photos so you can share event moments and attach inventory images.',
      cameraPermission: 'Allow TDF Records to use your camera to scan vCard QR codes, capture inventory images, and broadcast live video.'
    }
  ],
  [
    'expo-location',
    {
      locationAlwaysAndWhenInUsePermission: false,
      locationAlwaysPermission: false,
      locationWhenInUsePermission: 'Allow TDF Records to use your location to show nearby venues.'
    }
  ],
  [
    '@stripe/stripe-react-native',
    STRIPE_MERCHANT_IDENTIFIER
      ? {
          merchantIdentifier: STRIPE_MERCHANT_IDENTIFIER
        }
      : {}
  ]
];

if (GOOGLE_IOS_URL_SCHEME) {
  plugins.push([
    '@react-native-google-signin/google-signin',
    {
      iosUrlScheme: GOOGLE_IOS_URL_SCHEME
    }
  ]);
}

const googleAuthExtra = {
  ...(GOOGLE_WEB_CLIENT_ID ? { webClientId: GOOGLE_WEB_CLIENT_ID } : {}),
  ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
  ...(GOOGLE_IOS_URL_SCHEME ? { iosUrlScheme: GOOGLE_IOS_URL_SCHEME } : {})
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: APP_SLUG,
  scheme: APP_SCHEME,
  version: APP_VERSION,
  description: 'TDF Records mobile app for bookings, events, venues, inventory, pipelines, and social tools.',
  icon: './assets/icon.png',
  runtimeVersion: APP_VERSION,
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: BRAND_BACKGROUND
  },
  ios: {
    bundleIdentifier: IOS_BUNDLE_ID,
    supportsTablet: false,
    config: {
      usesNonExemptEncryption: false
    }
  },
  android: {
    package: ANDROID_PACKAGE,
    versionCode: ANDROID_VERSION_CODE,
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
  plugins,
  updates:
    EAS_BUILD_PROFILE === 'ios-simulator'
      ? { checkAutomatically: 'ON_ERROR_RECOVERY' as const }
      : config.updates,
  experiments: {
    ...(config.experiments ?? {}),
    typedRoutes: true
  },
  extra: {
    ...(config.extra ?? {}),
    apiBase: API_BASE,
    uploadUrl: UPLOAD_URL,
    appEnvironment: EAS_BUILD_PROFILE,
    defaultTimeZone: DEFAULT_TZ,
    supportEmail: SUPPORT_EMAIL,
    ...(Object.keys(googleAuthExtra).length > 0 ? { googleAuth: googleAuthExtra } : {}),
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
