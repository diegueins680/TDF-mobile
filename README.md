# TDF Records Mobile

Expo/React Native app for TDF Records operations. The current app covers bookings, venues, events, inventory, pipelines, contact card scanning, and related social workflows against the TDF backend.

## Environment

Local development falls back to `http://localhost:8080` and `http://localhost:8080/drive/upload` if these are unset, but you can export them explicitly:

```bash
export EXPO_PUBLIC_API_BASE=http://localhost:8080
export EXPO_PUBLIC_UPLOAD_URL=http://localhost:8080/drive/upload
export EXPO_PUBLIC_TZ=America/Guayaquil
```

EAS `preview` and `production` builds inject these release endpoints from `eas.json`:

```bash
EXPO_PUBLIC_API_BASE=https://tdf-hq.fly.dev
EXPO_PUBLIC_UPLOAD_URL=https://tdf-hq.fly.dev/drive/upload
EXPO_PUBLIC_TZ=America/Guayaquil
```

Google Sign-In in native builds also needs mobile-specific env values:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<google-web-client-id>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<google-ios-client-id>
GOOGLE_IOS_URL_SCHEME=<reversed-ios-client-id>
```

Notes:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is required for Android and iOS Google login.
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `GOOGLE_IOS_URL_SCHEME` are required to prove Google login on iOS native builds.
- `app.config.ts` only registers the Google native plugin when `GOOGLE_IOS_URL_SCHEME` is present, so changing these values requires a native rebuild.

`app.config.ts` also falls back to these release URLs automatically when `EAS_BUILD_PROFILE` is `preview` or `production`, so cloud builds do not depend on Expo injecting the profile envs before config evaluation.

Optional release-time override:

```bash
export EAS_PROJECT_ID=<expo-project-id>
```

Development-only override:

```bash
export EXPO_PUBLIC_API_TOKEN=<temporary-bearer-token>
```

Do not embed `EXPO_PUBLIC_API_TOKEN` in `preview` or `production` builds.

You can copy defaults from `.env.example` for local QA and release setup.

## Commands

```bash
npm run start
npm run ios
npm run android
npm run web
npm run lint
npm run typecheck
npm run test
npm run release:assets
npm run release:check
npm run doctor
npm run expo:config
npm run prebuild:check
npm run build:ios:preview
npm run build:ios:production
npm run build:android:preview
npm run build:android:production
npm run submit:ios:production
npm run submit:android:production
```

## Release Files

- Release process: [docs/release.md](docs/release.md)
- Store submission handoff: [STORE_SUBMISSION_HANDOFF.md](STORE_SUBMISSION_HANDOFF.md)
- Source privacy policy: [docs/privacy-policy.md](docs/privacy-policy.md)
- Source terms of service: [docs/terms-of-service.md](docs/terms-of-service.md)
- Source support page: [docs/support.md](docs/support.md)
- Source data deletion page: [docs/data-deletion.md](docs/data-deletion.md)
- Store checklist and templates: [docs/release/store-submission-checklist.md](docs/release/store-submission-checklist.md)

## Public Release URLs

- Privacy policy: `https://tdf-app.pages.dev/mobile-app/privacy.html`
- Terms of service: `https://tdf-app.pages.dev/mobile-app/terms.html`
- Support: `https://tdf-app.pages.dev/mobile-app/support.html`
- Data deletion: `https://tdf-app.pages.dev/mobile-app/data-deletion.html`

## Notes

- Expo config is centralized in `app.config.ts`.
- Store-ready app identifiers are `com.tdfrecords.app` for iOS and `com.tdf.records` for Android.
- EAS production builds use remote versioning from `eas.json`; do not set local build numbers for release builds.
- Release assets are generated from shared TDF branding in the parent workspace by `scripts/generate_release_assets.py`.
- The `/about` screen shows the resolved API base, health status, and version info.
- Auth now uses username/password and Google login in-app; the old bearer-token flow is no longer the primary path.
