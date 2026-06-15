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

## Platform Known Issues

This section documents host-specific behavior on the primary macOS build machine so Platform and Release agents don't rediscover them every run.

### `xcodebuild -list` can hang (>45 s)

Symptom: `cd ios && xcodebuild -list` times out and leaves an orphaned `xcodebuild` process. The `-workspace TDFRecords.xcworkspace` variant also hangs.
Impact: Automated scheme verification fails; process leak risk if orphans accumulate.
Workaround: Builds still succeed via `xcodebuild -scheme TDFRecords` or `npx detox build`. If `-list` is needed, read the scheme XML directly (`cat ios/TDFRecords.xcodeproj/xcshareddata/xcschemes/TDFRecords.xcscheme`). Monitor for orphans (`pgrep xcodebuild`) and kill with `killall -9 xcodebuild`.
Status: DEGRADED — both `-project` and `-workspace` variants exceed 60 s as of 2026-05-16 06:36 UTC.
Owner: tdf-label-platform.

### `xcrun simctl list` hangs

Symptom: `xcrun simctl list devices` and related commands hang indefinitely.
Impact: Simulator boot checks and Detox device management via simctl are blocked.
Workaround: Device UUID is pinned in `.detoxrc.js` (`8DB9DCE0-2F80-49C9-A614-F21DA3876B7B`). Detox can still launch the simulator directly. Use `ps aux | grep CoreSimulator` to verify simulator runtime health.
Status: ONGOING.
Owner: tdf-label-platform / host.

## E2E Testing

Standard fresh-install run (deterministic, no `--reuse`):

```bash
# 1. Start Metro
npx expo start

# 2. In another terminal, run the full Detox suite
npx detox test --configuration ios.sim.debug
```

Prerequisites:
- Backend running on `http://localhost:8080` (`tdf-hq-exe` with `APP_PORT=8080`)
- iOS simulator booted and app binary built (`npx detox build --configuration ios.sim.debug`)
- Simulator UUID pinned in `.detoxrc.js` (default: `8DB9DCE0-2F80-49C9-A614-F21DA3876B7B`)

Notes:
- The e2e test uses `device.clearKeychain()` and `delete: true` to guarantee a fresh login state on every run.
- Do not use `--reuse`; it skips the fresh install and can leave the app in a logged-in state, causing false positives.
- The debug build requires Metro to serve the JS bundle. For headless/release testing, a Release-iphonesimulator build with an embedded bundle is required.
