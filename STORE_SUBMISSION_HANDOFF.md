# Store Submission Handoff

## What was added

- Consolidated Expo configuration into `app.config.ts` and removed the placeholder `app.json`.
- Added iOS bundle identifier `com.tdf.records` and confirmed Android application ID `com.tdf.records`.
- Added release asset generation and generated `assets/app-icon.png`, `assets/adaptive-icon.png`, `assets/splash-icon.png`, and `assets/favicon.png`.
- Added `eas.json` build profiles for `development`, `preview`, `production`, and `ios-simulator`.
- Added release helper scripts in `package.json` plus `scripts/release-check.mjs`.
- Hardened release env handling so preview/production builds require backend URLs and reject embedded API tokens.
- Added store metadata, privacy, support, and checklist templates under `docs/release/`.
- Updated the in-app About tab to expose version/build/environment details for support.

## Current release identifiers

App version: `1.0.0`

iOS bundle identifier: `com.tdf.records`

Android application ID: `com.tdf.records`

Default iOS build number: `1`

Default Android version code: `1`

Deep link scheme: `tdf`

## How to build and submit

1. Set production env vars from `.env.example`.
2. Run `npm run release:check`.
3. Run `npm run expo:config` and `npm run doctor`.
4. Build with `npm run build:ios:production` and `npm run build:android:production`.
5. Submit with `npm run submit:ios:production` and `npm run submit:android:production`, or upload the artifacts manually in App Store Connect / Google Play Console.

## Validation status

- `python3 scripts/generate-release-assets.py`: passed
- `python3 -m py_compile scripts/generate-release-assets.py`: passed
- `node --check scripts/release-check.mjs`: passed
- `node scripts/release-check.mjs`: expected failure without release env vars (`EXPO_PUBLIC_API_BASE`, `EXPO_PUBLIC_UPLOAD_URL`)
- `npm install --offline --no-audit --progress=false`: failed in this sandbox with `ENOTCACHED`, so `lint`, `typecheck`, `test`, `expo config`, `expo-doctor`, and `prebuild` could not be executed here

## Non-repo blockers

- Real production values for `EXPO_PUBLIC_API_BASE` and `EXPO_PUBLIC_UPLOAD_URL`.
- Apple signing setup and App Store Connect app record.
- Google Play signing / service account setup and Play Console app record.
- Public privacy policy URL and public support URL/email page.
- Reviewer credentials or a demo bearer token for the authenticated portions of the app.
