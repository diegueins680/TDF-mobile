# TDF Mobile Release Setup

Last updated: 2026-05-13

## App Identity

- App name: `TDF Records`
- Expo slug: `tdf-mobile`
- iOS bundle identifier: `com.tdfrecords.app`
- Android package: `com.tdf.records`
- Marketing version: `1.0.1`
- Build numbers: managed by EAS remote versioning with `autoIncrement` in `eas.json`

## Public Store URLs

- Privacy policy: `https://tdf-app.pages.dev/mobile-app/privacy.html`
- Terms of service: `https://tdf-app.pages.dev/mobile-app/terms.html`
- Support: `https://tdf-app.pages.dev/mobile-app/support.html`
- Data deletion: `https://tdf-app.pages.dev/mobile-app/data-deletion.html`

## Build Environment

Local development keeps the existing `localhost` fallback. Export these values explicitly if you need to point a device or simulator elsewhere:

```bash
export EXPO_PUBLIC_API_BASE=http://localhost:8080
export EXPO_PUBLIC_UPLOAD_URL=http://localhost:8080/drive/upload
export EXPO_PUBLIC_TZ=America/Guayaquil
```

EAS `preview` and `production` profiles set the release backend automatically via `eas.json`:

```bash
EXPO_PUBLIC_API_BASE=https://tdf-hq.fly.dev
EXPO_PUBLIC_UPLOAD_URL=https://tdf-hq.fly.dev/drive/upload
EXPO_PUBLIC_TZ=America/Guayaquil
```

`app.config.ts` also falls back to these same release URLs whenever `EAS_BUILD_PROFILE` is `preview` or `production`. That keeps cloud builds from failing or defaulting to `localhost` if Expo evaluates the config before profile env injection completes.

Optional if the Expo project is not yet linked locally:

```bash
export EAS_PROJECT_ID=<expo-project-id>
```

## Release Commands

```bash
npm run release:assets
npm run release:assets:check
npm run release:check
npm run doctor
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform ios --profile production --latest
npx eas-cli@latest submit --platform android --profile production --latest
```

## Testing Version Baselines

| Build ID | Date | Parent SHA | tdf-mobile SHA | Profile | Verdict | Evidence |
|---|---|---|---|---|---|---|
| `8d91fabe-a01c-41d1-bc6b-b55dc9c689e9` | 2026-05-13 | `a47331d9` | `b7f5839` | `ios-simulator` | **GO** — Both username/password and Google OAuth proven via Detox on EAS artifact without Metro. | `tdf-label-release.md` report entry 2026-05-13 20:35 UTC; Detox screenshots in `artifacts/ios.sim.release.2026-05-13 15-35-20Z/`. |

> **How to reproduce this baseline:**
> ```bash
> cd tdf-mobile && npx eas-cli@latest build --profile ios-simulator --platform ios --non-interactive
> ```
> Then run: `npx detox test --configuration ios.sim.release`

## Notes

- `app.config.ts` is the single source of truth for Expo metadata.
- The committed app icons and splash image are validated for format and dimensions by `release:assets:check` before every release gate.
- The tracked native projects are intentional. `release-check.mjs` verifies their canonical app identifiers, while Expo Doctor's generic app-config/native-sync warning is disabled for this repository.
- `react-native-webrtc` remains required for live broadcasts and is excluded only from Expo Doctor's directory-metadata check; native builds and broadcast tests remain authoritative.
- `.github/workflows/mobile-validate.yml` runs the release gate, Jest, and official Expo Doctor for pull requests and `main`. The separately dispatched readiness workflow starts EAS builds only when an operator explicitly opts in and `EXPO_TOKEN` is configured.
- `eas.json` defines `development`, `preview`, and `production` profiles.
- `preview` and `production` profiles pin the release API and upload endpoints so cloud builds never fall back to `localhost`.
- EAS remote versioning owns iOS build numbers and Android version codes for release builds.
- Permission copy is configured for camera, photo library, and foreground location because those capabilities already exist in the app.
- If the Expo project has not been initialized yet, run `npx eas-cli@latest project:init` or `npx eas-cli@latest build:configure` once while authenticated, then persist the resulting project ID.
