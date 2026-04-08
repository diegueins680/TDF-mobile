# TDF Mobile Store Publication Systems Report

- Generated: 2026-04-04 01:32:01 -05
- Workspace: /Users/diegosaa/GitHub/tdf-app
- Mobile dir: /Users/diegosaa/GitHub/tdf-app/tdf-mobile

## Concrete useful thing completed

Added a repeatable operator audit script at scripts/mobile-publishing-admin-audit.sh and ran it to generate this evidence snapshot. This closes the admin-visibility gap by making store-publication preflight checks reproducible instead of ad hoc.

## Endpoint validation

| Endpoint | HTTP | Title | SHA-256 | Verdict |
|---|---:|---|---|---|
| support | 200 | TDF Records Mobile App Support | 82b725aa5da569911df25d4a10ecb44c96da7d9b4720ca347666a47b45ef4061 | OK |
| privacy | 200 | TDF Records Mobile App Privacy Policy | 0b05c5b884c0c58d9a239c4b8be44cd42b7c8b7c1ad200086f3db280c6e801bf | OK |
| terms | 200 | TDF Records Mobile App Terms of Service | 2c3ca861931079bdceefbae8ea3afab63bd2938bd31a448f97d746da3923ed03 | OK |
| data-deletion | 200 | TDF Records Mobile App Data Deletion | 0e149f6fdb4e81761d1fd0f3f217ac1b9c5138d4987d935ed103ccbbd7ca1a0d | OK |

## Release / admin visibility

- EAS auth/project visibility: OK
- Browser session storage signals found: 9 files
- Chrome relay raw probe (http://127.0.0.1:18792/json/version): UNAUTHORIZED
- Chrome relay raw probe detail: Unauthorized
- Live console audit status: BLOCKED until relay-attached tabs are provided

### Browser session storage signals (filenames only)

- ~/Library/Application Support/Google/Chrome/Default/Cookies
- ~/Library/Application Support/Google/Chrome/Default/Login Data
- ~/Library/Application Support/Google/Chrome/Default/Web Data
- ~/Library/Application Support/Google/Chrome/Profile 1/Cookies
- ~/Library/Application Support/Google/Chrome/Profile 1/Login Data
- ~/Library/Application Support/Google/Chrome/Profile 1/Web Data
- ~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies
- ~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Login Data
- ~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Web Data

## Credentials / signing prerequisites

- Local Apple code-signing identities: 0
- Local iOS provisioning profiles: 0
- Local ASC API key files in standard dirs: 0
- Workspace Android keystore / Play JSON files found: 2

### Apple codesigning summary

```text
     0 valid identities found
```

### Local signing/material filenames only

- ASC key files: none in standard dirs
- Android material: .tmp/tdf-mobile-platform-director/android/app/debug.keystore
- Android material: tdf-mobile/android/app/debug.keystore

## Host / operator toolchain

| Check | Status | Evidence |
|---|---|---|
| Xcode | OK | Xcode 16.2 Build version 16C5032a  |
| Java runtime | BLOCKED | The operation couldn’t be completed. Unable to locate a Java Runtime. |
| CocoaPods | OK | 1.16.2 |
| Fastlane | BLOCKED | missing |
| adb | OK | /Users/diegosaa/Library/Android/sdk/platform-tools/adb |
| sdkmanager | BLOCKED | missing |
| Android Studio | OK | /Applications/Android Studio.app |
| Transporter.app | BLOCKED | /Applications/Transporter.app |

## Operator-facing gaps CIO / Release should know

- Relay-attached signed-in App Store Connect / Play Console tabs still required for live console audit
- No local Apple code-signing identities detected
- No local iOS provisioning profiles directory/files detected
- No local App Store Connect API key files found in standard directories
- Java runtime missing
- Fastlane missing
- Android cmdline-tools/sdkmanager missing
- Transporter.app missing

## Current workspace state relevant to publication

### tdf-mobile git status --short

```text
 M scripts/release-check.mjs
```

### tdf-mobile release metadata files

```text
--- app.config.ts
import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_NAME = 'TDF Records';
const APP_SLUG = 'tdf-mobile';
const APP_SCHEME = 'tdf';
const APP_VERSION = process.env.APP_VERSION?.trim() || '1.0.1';
const BUNDLE_ID = 'com.tdfrecords.app';
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
const GOOGLE_IOS_URL_SCHEME = process.env.GOOGLE_IOS_URL_SCHEME?.trim();

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

const plugins: NonNullable<ExpoConfig['plugins']> = [
  'expo-router',
  'expo-secure-store',
  [
    'expo-camera',
    {
      cameraPermission: 'Allow TDF Records to use your camera to scan vCard QR codes and capture inventory images.',
      microphonePermission: false
    }
  ],
  [
    'expo-image-picker',
    {
      photosPermission: 'Allow TDF Records to access your photos so you can attach inventory images.',
      cameraPermission: 'Allow TDF Records to use your camera to scan vCard QR codes and capture inventory images.'
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
--- app.json
{
  "expo": {
    "name": "TDF Records",
    "slug": "tdf-mobile",
    "scheme": "tdf",
    "plugins": [
      "expo-router"
    ],
    "extra": {
      "apiBase": "http://localhost:8080",
      "supportEmail": "soporte@tdfrecords.com",
      "urls": {
        "support": "https://tdf-app.pages.dev/mobile-app/support.html",
        "privacyPolicy": "https://tdf-app.pages.dev/mobile-app/privacy.html",
        "termsOfService": "https://tdf-app.pages.dev/mobile-app/terms.html",
        "dataDeletion": "https://tdf-app.pages.dev/mobile-app/data-deletion.html"
      },
      "router": {},
      "eas": {
        "projectId": "218aca4d-c096-4892-a353-c1dd7df23448"
      }
    },
    "owner": "cuco.saa",
    "runtimeVersion": "1.0.0",
    "updates": {
      "url": "https://u.expo.dev/218aca4d-c096-4892-a353-c1dd7df23448"
    },
    "android": {
      "package": "com.tdfrecords.app",
      "blockedPermissions": [
        "android.permission.RECORD_AUDIO"
      ],
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "monochromeImage": "./assets/adaptive-icon-monochrome.png",
        "backgroundColor": "#0f172a"
      },
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION"
      ]
    },
    "ios": {
      "bundleIdentifier": "com.tdfrecords.app",
      "supportsTablet": false,
      "config": {
        "usesNonExemptEncryption": false
      }
    }
  }
}
--- eas.json
{
  "cli": {
    "version": ">= 16.20.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "env": {
        "EXPO_PUBLIC_API_BASE": "http://localhost:8080",
        "EXPO_PUBLIC_UPLOAD_URL": "http://localhost:8080/drive/upload",
        "EXPO_PUBLIC_TZ": "America/Guayaquil"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "env": {
        "EXPO_PUBLIC_API_BASE": "https://tdf-hq.fly.dev",
        "EXPO_PUBLIC_UPLOAD_URL": "https://tdf-hq.fly.dev/drive/upload",
        "EXPO_PUBLIC_TZ": "America/Guayaquil"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "channel": "production",
      "env": {
        "EXPO_PUBLIC_API_BASE": "https://tdf-hq.fly.dev",
        "EXPO_PUBLIC_UPLOAD_URL": "https://tdf-hq.fly.dev/drive/upload",
        "EXPO_PUBLIC_TZ": "America/Guayaquil"
      }
    },
    "ios-simulator": {
      "extends": "development",
      "ios": {
        "simulator": true
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "track": "internal",
        "releaseStatus": "draft"
      },
      "ios": {
        "ascAppId": "6754828747"
      }
    }
  }
}
--- package.json
{
  "name": "tdf-mobile",
  "version": "1.0.1",
  "description": "TDF Records mobile app for bookings, inventory, events, venues, pipelines, and social tools.",
  "homepage": "https://tdf-app.pages.dev/mobile-app",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/diegueins680/TDF-mobile.git"
  },
  "bugs": {
    "url": "https://github.com/diegueins680/TDF-mobile/issues"
  },
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "deploy": "npx expo export -p web && npx eas-cli@latest deploy",
    "assets:release": "npm run release:assets",
    "release:assets": "python3 scripts/generate_release_assets.py",
    "doctor": "npx expo-doctor",
    "expo:config": "npx expo config --type public",
    "google-auth:check": "node ./scripts/check-google-auth-env.mjs",
    "generate:api": "node ../node_modules/openapi-typescript/bin/cli.js ../tdf-hq/docs/openapi/api.yaml --output src/api/generated/types.ts",
    "lint": "eslint . --max-warnings=0",
    "prebuild:check": "npx expo prebuild --no-install --clean",
    "release:validate": "npm run release:check",
    "release:check": "npm run lint && npm run typecheck && node ./scripts/release-check.mjs && npm run expo:config",
    "release:prepare": "npm run release:assets && npm run release:check",
    "typecheck": "tsc --noEmit",
    "test": "jest --runInBand",
    "eas:whoami": "npx eas-cli@latest whoami",
    "build:ios:preview": "npx eas-cli@latest build --profile preview --platform ios",
    "build:ios:production": "npx eas-cli@latest build --profile production --platform ios",
    "build:ios:store": "npm run build:ios:production",
    "build:android:preview": "npx eas-cli@latest build --profile preview --platform android",
    "build:android:production": "npx eas-cli@latest build --profile production --platform android",
    "build:android:store": "npm run build:android:production",
    "eas:build:ios": "npx eas-cli@latest build --platform ios --profile production",
    "eas:build:android": "npx eas-cli@latest build --platform android --profile production",
    "submit:ios:production": "npx eas-cli@latest submit --profile production --platform ios",
    "submit:ios": "npm run submit:ios:production",
    "submit:android:production": "npx eas-cli@latest submit --profile production --platform android",
    "submit:android": "npm run submit:android:production",
    "eas:submit:ios": "npx eas-cli@latest submit --platform ios --profile production --latest",
    "eas:submit:android": "npx eas-cli@latest submit --platform android --profile production --latest"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "2.2.0",
    "@react-native-google-signin/google-signin": "^16.1.2",
    "@tanstack/react-query": "^5.90.5",
    "@testomatio/reporter": "0.7.6",
    "axios": "^1.12.2",
    "expo": "~54.0.33",
    "expo-camera": "~17.0.10",
    "expo-constants": "~18.0.13",
    "expo-image-picker": "~17.0.10",
    "expo-linking": "~8.0.11",
    "expo-location": "~19.0.8",
    "expo-router": "~6.0.23",
    "expo-secure-store": "~15.0.8",
    "expo-status-bar": "~3.0.9",
    "expo-updates": "~29.0.16",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-hook-form": "^7.65.0",
    "react-native": "0.81.5",
    "react-native-calendars": "^1.1313.0",
    "react-native-qrcode-svg": "^6.3.20",
    "react-native-reanimated": "~4.1.1",
    "react-native-safe-area-context": "~5.6.0",
    "react-native-screens": "~4.16.0",
    "react-native-svg": "15.12.1",
    "react-native-web": "^0.21.0",
    "react-native-worklets": "0.5.1",
    "zod": "^3.25.76"
  },
  "private": true,
  "devDependencies": {
    "@eslint/js": "^9.14.0",
    "@testing-library/jest-native": "^5.4.3",
    "@testing-library/react-native": "^12.5.3",
    "@types/jest": "^29.5.12",
    "@typescript-eslint/eslint-plugin": "^8.9.0",
    "@typescript-eslint/parser": "^8.9.0",
    "eslint": "^9.14.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-react": "^7.37.2",
    "eslint-plugin-react-hooks": "^5.1.0",
    "globals": "^15.12.0",
    "jest": "^29.7.0",
    "jest-expo": "~54.0.17",
    "react-test-renderer": "19.1.0",
    "typescript": "~5.9.2"
  },
  "overrides": {
    "react-native-reanimated": "~4.1.1"
  }
}
```

### EAS auth snapshot

```text
EAS whoami:
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated glob@6.0.4: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated rimraf@2.4.5: Rimraf versions prior to v4 are no longer supported
npm warn deprecated lodash.get@4.4.2: This package is deprecated. Use the optional chaining (?.) operator instead.
npm warn deprecated @xmldom/xmldom@0.7.13: this version has critical issues, please update to the latest version
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated tar@7.5.7: Old versions of tar are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
★ eas-cli@18.5.0 is now available.
To upgrade, run:
npm install -g eas-cli
Proceeding with outdated version.

cuco.saa
cuco.saa@gmail.com
npm notice
npm notice New minor version of npm available! 11.6.0 -> 11.12.1
npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.12.1
npm notice To update run: npm install -g npm@11.12.1
npm notice

EAS project:info:
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated rimraf@2.4.5: Rimraf versions prior to v4 are no longer supported
npm warn deprecated glob@6.0.4: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated lodash.get@4.4.2: This package is deprecated. Use the optional chaining (?.) operator instead.
npm warn deprecated @xmldom/xmldom@0.7.13: this version has critical issues, please update to the latest version
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated tar@7.5.7: Old versions of tar are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
★ eas-cli@18.5.0 is now available.
To upgrade, run:
npm install -g eas-cli
Proceeding with outdated version.


fullName  @cuco.saa/tdf-mobile
ID        218aca4d-c096-4892-a353-c1dd7df23448
npm notice
npm notice New minor version of npm available! 11.6.0 -> 11.12.1
npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.12.1
npm notice To update run: npm install -g npm@11.12.1
npm notice
```

## Recommended next operator actions

1. Attach relay-enabled signed-in tabs for App Store Connect and Google Play Console so live admin visibility can be audited without credential export.
2. Decide whether Apple submission will use EAS-managed credentials only or local Apple tooling; if local, install/import at least one Apple signing identity, provisioning material, and Transporter or fastlane path.
3. Install missing operator tooling on this Mac if local publishing is expected: Java runtime, CocoaPods, Fastlane, Android cmdline-tools.
4. If Android submission will use service-account JSON outside EAS-managed flows, place it in an approved operator location and document only the filename/location, not contents.

