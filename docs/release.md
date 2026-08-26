# TDF Mobile Release Setup

Last updated: 2026-03-13

## App Identity

- App name: `TDF Records`
- Expo slug: `tdf-mobile`
- iOS bundle identifier: `com.tdfrecords.app`
- Android package: `com.tdfrecords.app`
- Marketing version: `1.0.0`
- Build numbers: managed by EAS remote versioning with `autoIncrement` in `eas.json`

## Public Store URLs

- Privacy policy: `https://tdf-app.pages.dev/mobile-app/privacy.html`
- Terms of service: `https://tdf-app.pages.dev/mobile-app/terms.html`
- Support: `https://tdf-app.pages.dev/mobile-app/support.html`
- Data deletion: `https://tdf-app.pages.dev/mobile-app/data-deletion.html`

## Build Environment

Local development keeps the existing `localhost` fallback. The repo ships `.env.example` and a local `.npm-cache/` via `.npmrc` so clean installs stay repo-scoped.

Export these values explicitly if you need to point a device or simulator elsewhere:

```bash
export EXPO_PUBLIC_API_BASE=http://localhost:8080
export EXPO_PUBLIC_UPLOAD_URL=http://localhost:8080/drive/upload
export EXPO_PUBLIC_TZ=America/Guayaquil
```

EAS `preview` and `production` profiles set the release backend automatically via `eas.json`:

```bash
EXPO_PUBLIC_API_BASE=https://the-dream-factory.koyeb.app
EXPO_PUBLIC_UPLOAD_URL=https://the-dream-factory.koyeb.app/drive/upload
```

Optional if the Expo project is not yet linked locally:

```bash
export EAS_PROJECT_ID=<expo-project-id>
```

## Release Commands

```bash
npm run release:assets
npm run release:assets:check
npm run release:check
npx expo-doctor
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform ios --profile production --latest
npx eas-cli@latest submit --platform android --profile production --latest
```

## Notes

- `app.config.ts` is the single source of truth for Expo metadata.
- `tsconfig.node.json` typechecks `app.config.ts` with Node typings separately from the Expo app bundle.
- `eas.json` defines `development`, `preview`, and `production` profiles.
- `preview` and `production` profiles pin the release API and upload endpoints so cloud builds never fall back to `localhost`.
- EAS remote versioning owns iOS build numbers and Android version codes for release builds.
- Permission copy is configured for camera, photo library, and foreground location because those capabilities already exist in the app.
- Android production build `aef4c356-0a8b-48e9-aa04-5c86fc168385` failed in `:expo-barcode-scanner:compileReleaseKotlin` because `expo-barcode-scanner` resolved missing `expo.modules.interfaces.barcodescanner` symbols; the vCard QR flow now uses `expo-camera` instead.
- Canonical release artwork lives in `assets/release-source/`. `npm run release:assets` copies that committed set into the exact asset paths consumed by `app.config.ts`.
- `npx expo-doctor` is repo-local and intentionally offline-capable so CI and fresh installs do not rely on fetching extra tooling.
- If the Expo project has not been initialized yet, run `npx eas-cli@latest project:init` or `npx eas-cli@latest build:configure` once while authenticated, then persist the resulting project ID.
