# Store Release Guide

This repo now includes the minimum Expo/EAS release scaffolding to build and submit `TDF Records` for both Google Play and the Apple App Store.

## Versioning

- Marketing version: `1.0.0`
- iOS build number: `1`
- Android version code: `1`

Override build numbers with `IOS_BUILD_NUMBER` and `ANDROID_VERSION_CODE` when cutting later builds.

## Files Added For Release

- Expo release config: `app.config.ts`
- Base Expo config: `app.json`
- EAS profiles: `eas.json`
- Generated store assets: `assets/release/*`
- Asset generator: `scripts/generate-release-assets.mjs`
- Store metadata templates: `docs/release/store-metadata.md`
- Reviewer notes: `docs/release/submission-notes.md`
- Privacy/data-safety checklist: `docs/release/privacy-and-data-safety.md`
- Example environment values: `.env.example`

## Required Environment

Copy `.env.example` into your local `.env` or your EAS environment and replace placeholders:

- `EXPO_PUBLIC_API_BASE`
- `EXPO_PUBLIC_UPLOAD_URL`
- `EXPO_PUBLIC_TZ`
- `EAS_PROJECT_ID`

`EXPO_PUBLIC_API_TOKEN` is optional and intended for internal QA or reviewer/demo access.

## Build Flow

```sh
npm install
npm run assets:release
npm run release:validate
npm run build:android:store
npm run build:ios:store
```

## Submit Flow

Google Play:

```sh
npm run submit:android
```

App Store:

```sh
npm run submit:ios
```

## Remaining Manual Inputs

- Provide a real reviewer/demo bearer token or deterministic review path before App Store / Play review.
- Provide the App Store Connect / Google Play credential handoff for the submission path you will use.
- Enter the recorded App Store review contact card details in App Store Connect, provide the final privacy/data-safety answers, and attach the final screenshots before submission.

## Release Truths Already Fixed In Repo

- Store metadata now points at the live Pages-hosted support, privacy, terms, and data-deletion URLs.
- The canonical mobile app identifiers in the current repo are `com.tdfrecords.app` for iOS and `com.tdf.records` for Android.
- `app.json` already carries the Expo project ID `218aca4d-c096-4892-a353-c1dd7df23448`, so do not re-run `eas init` unless that linkage is intentionally changed.
