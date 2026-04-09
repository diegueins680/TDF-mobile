# Store Submission Handoff

## What was added

- Consolidated Expo configuration into `app.config.ts` while keeping `app.json` only for linked Expo project metadata.
- Added the store-ready iOS bundle identifier `com.tdfrecords.app` and Android application ID `com.tdf.records`.
- Added release asset generation and generated `assets/icon.png`, `assets/adaptive-icon.png`, `assets/adaptive-icon-monochrome.png`, `assets/splash.png`, and `assets/favicon.png`.
- Added `eas.json` build profiles for `development`, `preview`, `production`, and `ios-simulator`, with release URLs pinned for cloud builds.
- Added release helper scripts in `package.json` plus `scripts/release-check.mjs`.
- Hardened release env handling so preview/production builds resolve the release backend even if Expo evaluates `app.config.ts` before EAS injects profile env vars, while still rejecting embedded API tokens.
- Replaced the old manual bearer-token-first auth entry with username/password login plus Google login wired to the existing backend endpoints.
- Moved persisted session storage to Expo SecureStore with migration from the legacy AsyncStorage token key.
- Added store metadata, privacy, support, and checklist templates under `docs/release/`.
- Updated the in-app About experience to expose version/build/environment details plus public support and legal links.

## Current release identifiers

App version: `1.0.0`

iOS bundle identifier: `com.tdfrecords.app`

Android application ID: `com.tdf.records`

Release build numbers: managed by EAS remote versioning

Deep link scheme: `tdf`

## Published public pages

- Support: `https://tdf-app.pages.dev/mobile-app/support.html`
- Privacy policy: `https://tdf-app.pages.dev/mobile-app/privacy.html`
- Terms of service: `https://tdf-app.pages.dev/mobile-app/terms.html`
- Data deletion: `https://tdf-app.pages.dev/mobile-app/data-deletion.html`

## How to build and submit

1. Copy release defaults from `.env.example` if you need local QA overrides, but rely on `eas.json` + `app.config.ts` fallbacks for cloud `preview` and `production` builds.
2. For Google login in native builds, provide real values for `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and `GOOGLE_IOS_URL_SCHEME` before building. The iOS URL scheme must be present before the native build is generated.
3. Run `npm run release:check`.
4. Run `npm run expo:config` and `npm run doctor`.
5. Build with `npm run build:ios:production` and `npm run build:android:production`.
6. Submit with `npm run submit:ios:production` and `npm run submit:android:production`, or upload the artifacts manually in App Store Connect / Google Play Console.

## Validation status

- `python3 scripts/generate_release_assets.py`: passed
- `python3 -m py_compile scripts/generate_release_assets.py`: passed
- `node --check scripts/release-check.mjs`: passed
- `node scripts/release-check.mjs`: resolves release URLs automatically for `preview` and `production` profiles
- `npm install --offline --no-audit --progress=false`: failed in this sandbox with `ENOTCACHED`, so `lint`, `typecheck`, `test`, `expo config`, `expo-doctor`, and `prebuild` could not be executed here

## Non-repo blockers

- Apple signing setup and App Store Connect app record.
- Google Play signing / service account setup and Play Console app record.
- Reviewer credentials or a demo account for the authenticated portions of the app.
- Mobile Google client IDs and iOS reversed URL scheme for native Google login proof/builds.
