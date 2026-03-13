# TDF Records Mobile

Expo Router mobile app for TDF Records operations. The app exposes parties, bookings, pipelines, events, social/vCard flows, venue discovery, and inventory management against the TDF backend APIs.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` or export the variables in your shell.
3. Run `npm run start`, `npm run ios`, or `npm run android`.

Development builds can use a temporary bearer token through `EXPO_PUBLIC_API_TOKEN`, but store builds must not embed one.

## Required environment variables

`EXPO_PUBLIC_API_BASE`
Backend base URL. Required for preview and production builds.

`EXPO_PUBLIC_UPLOAD_URL`
Upload endpoint used by the inventory flow. Required for preview and production builds.

`EXPO_PUBLIC_TZ`
Optional timezone override. Defaults to `America/Guayaquil`.

`IOS_BUILD_NUMBER`
Optional iOS build number override. Defaults to `1`.

`ANDROID_VERSION_CODE`
Optional Android version code override. Defaults to `1`.

## Release scripts

`npm run release:check`
Validate release environment variables and build numbering before running EAS.

`npm run expo:config`
Print the resolved Expo config.

`npm run doctor`
Run Expo Doctor.

`npm run prebuild:check`
Generate native projects temporarily to validate config plugins. Clean up generated `ios/` and `android/` folders afterward if they are not meant to be committed.

`npm run build:ios:production`
Start an App Store build with EAS.

`npm run build:android:production`
Start a Google Play build with EAS.

`npm run submit:ios:production`
Submit the latest iOS build through EAS Submit.

`npm run submit:android:production`
Submit the latest Android build through EAS Submit.

## Release documentation

Store submission, metadata, privacy, and handoff documents live under `docs/release/` and `STORE_SUBMISSION_HANDOFF.md`.
