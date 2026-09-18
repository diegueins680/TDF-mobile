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

## iOS archive on GitHub Actions (2026-09-18)

The `iOS Release Build` workflow uses the standard `macos-15` runner with Xcode
26.2, without an EAS cloud build or an Expo subscription. Standard hosted runners
are free for this public repository. This does not remove Apple's membership,
physical-device testing or review requirements.

Run the workflow manually from `main`, supplying an unused App Store Connect build
number (next reserved candidate: 23 for app version 1.0.1). Do not run a competing
EAS iOS build with that number. Concurrent workflow executions are serialized.
The `ios-release` environment permits `main` only and stores the existing
`TDF_IOS_DISTRIBUTION_P12`, `TDF_IOS_P12_PASSWORD` and
`TDF_IOS_PROVISIONING_PROFILE` as encrypted secrets. The workflow validates the
profile's app, team, distribution type, expiration and certificate match. Signing
uses an ephemeral keychain and removes the credentials even after failure.

Dependencies use `npm ci --include=dev` and `pod install --deployment`; source
release checks and tests must pass. Xcode archives the existing native project and
exports an App Store IPA. The artifact gate checks its signature, SDK, app/build
versions, Google/deep-link schemes and embedded production API. The one-day
artifact includes the IPA and a SHA256/source/run receipt, not signing secrets.
Download it promptly for the existing Apple validation/upload process.

A successful archive is **not** a TestFlight upload, App Review submission or
publication. Execute `docs/google-oauth-manual-test.md` on a physical iPhone before
production; preserve the manual release setting in App Store Connect. The initial
workflow execution and final source qualification are pending until their actual
run and artifact are recorded in the parent UX audit.

Sources checked 2026-09-18: [GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[Apple signing on GitHub](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications),
[macOS runner image](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-arm64-Readme.md),
[Apple SDK requirement](https://developer.apple.com/news/upcoming-requirements/?id=04282026a).
