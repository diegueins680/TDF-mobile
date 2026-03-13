# Store Submission Handoff

## What was added

- Consolidated Expo configuration into `app.config.ts` while keeping `app.json` only for linked Expo project metadata.
- Added the store-ready iOS bundle identifier `com.tdfrecords.app` and Android application ID `com.tdfrecords.app`.
- Added release asset generation and generated `assets/icon.png`, `assets/adaptive-icon.png`, `assets/adaptive-icon-monochrome.png`, `assets/splash.png`, and `assets/favicon.png`.
- Added `eas.json` build profiles for `development`, `preview`, `production`, and `ios-simulator`, with release URLs pinned for cloud builds.
- Added release helper scripts in `package.json` plus `scripts/release-check.mjs`.
- Hardened release env handling so preview/production builds resolve the release backend even if Expo evaluates `app.config.ts` before EAS injects profile env vars, while still rejecting embedded API tokens.
- Added store metadata, privacy, support, and checklist templates under `docs/release/`.
- Updated the in-app About experience to expose version/build/environment details plus public support and legal links.

## Current release identifiers

App version: `1.0.0`

iOS bundle identifier: `com.tdfrecords.app`

Android application ID: `com.tdfrecords.app`

Release build numbers: managed by EAS remote versioning

Deep link scheme: `tdf`

## Published public pages

- Support: `https://tdf-app.pages.dev/mobile-app/support.html`
- Privacy policy: `https://tdf-app.pages.dev/mobile-app/privacy.html`
- Terms of service: `https://tdf-app.pages.dev/mobile-app/terms.html`
- Data deletion: `https://tdf-app.pages.dev/mobile-app/data-deletion.html`

## How to build and submit

1. Copy release defaults from `.env.example` if you need local QA overrides, but rely on `eas.json` + `app.config.ts` fallbacks for cloud `preview` and `production` builds.
2. Run `npm run release:check`.
3. Run `npm run expo:config` and `npm run doctor`.
4. Build with `npm run build:ios:production` and `npm run build:android:production`.
5. Submit with `npm run submit:ios:production` and `npm run submit:android:production`, or upload the artifacts manually in App Store Connect / Google Play Console.

## Validation status

- `python3 scripts/generate_release_assets.py`: passed
- `python3 -m py_compile scripts/generate_release_assets.py`: passed
- `node --check scripts/release-check.mjs`: passed
- `node scripts/release-check.mjs`: resolves release URLs automatically for `preview` and `production` profiles
- `npm install --offline --no-audit --progress=false`: failed in this sandbox with `ENOTCACHED`, so `lint`, `typecheck`, `test`, `expo config`, `expo-doctor`, and `prebuild` could not be executed here

## Non-repo blockers

- Apple signing setup and App Store Connect app record.
- Google Play signing / service account setup and Play Console app record.
- Reviewer credentials or a demo bearer token for the authenticated portions of the app.
