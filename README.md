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
- Store-ready app identifiers are `com.tdfrecords.app` for both iOS and Android.
- EAS production builds use remote versioning from `eas.json`; do not set local build numbers for release builds.
- Release assets are generated from shared TDF branding in the parent workspace by `scripts/generate_release_assets.py`.
- The `/about` screen shows the resolved API base, health status, and version info.
