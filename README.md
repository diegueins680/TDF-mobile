# TDF Records Mobile

Expo/React Native app for TDF Records operations. The current app covers bookings, venues, events, inventory, pipelines, contact card scanning, and related social workflows against the TDF backend.

## Environment

The repo uses a local `.npm-cache/` via `.npmrc`, so clean installs do not depend on `~/.npm`.

Local development falls back to `http://localhost:8080` and `http://localhost:8080/drive/upload` if these are unset, but you can export them explicitly or start from `.env.example`:

```bash
export EXPO_PUBLIC_API_BASE=http://localhost:8080
export EXPO_PUBLIC_UPLOAD_URL=http://localhost:8080/drive/upload
export EXPO_PUBLIC_TZ=America/Guayaquil
```

EAS `preview` and `production` builds inject these release endpoints from `eas.json`:

```bash
EXPO_PUBLIC_API_BASE=https://the-dream-factory.koyeb.app
EXPO_PUBLIC_UPLOAD_URL=https://the-dream-factory.koyeb.app/drive/upload
```

Optional release-time override:

```bash
export EAS_PROJECT_ID=<expo-project-id>
```

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
npm run release:assets:check
npm run release:check
npx expo-doctor
```

## Release Files

- Release process: [docs/release.md](docs/release.md)
- Source privacy policy: [docs/privacy-policy.md](docs/privacy-policy.md)
- Source terms of service: [docs/terms-of-service.md](docs/terms-of-service.md)
- Source support page: [docs/support.md](docs/support.md)
- Source data deletion page: [docs/data-deletion.md](docs/data-deletion.md)

## Public Release URLs

- Privacy policy: `https://tdf-app.pages.dev/mobile-app/privacy.html`
- Terms of service: `https://tdf-app.pages.dev/mobile-app/terms.html`
- Support: `https://tdf-app.pages.dev/mobile-app/support.html`
- Data deletion: `https://tdf-app.pages.dev/mobile-app/data-deletion.html`

## Notes

- Expo config is centralized in `app.config.ts`.
- Store-ready app identifiers are `com.tdfrecords.app` for both iOS and Android.
- EAS production builds use remote versioning from `eas.json`; do not set local build numbers for release builds.
- Canonical release assets are stored in `assets/release-source/`; `npm run release:assets` syncs those committed files into the app paths referenced by `app.config.ts`.
- `npx expo-doctor` is provided by the repo and checks the release-blocking Expo peer, duplicate native module, and SDK alignment issues that matter for this app's CI gate.
