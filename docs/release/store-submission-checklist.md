# Store Submission Checklist

## Repo-complete items

- Stable Expo config lives in `app.config.ts`.
- iOS bundle identifier: `com.tdf.records`.
- Android application ID: `com.tdf.records`.
- Store assets are generated under `assets/`.
- EAS build profiles live in `eas.json`.
- Release environment validation lives in `scripts/release-check.mjs`.
- Store metadata and legal templates live in this folder.

## Before the next store upload

1. Set `EXPO_PUBLIC_API_BASE` and `EXPO_PUBLIC_UPLOAD_URL` to production services.
2. Confirm `EXPO_PUBLIC_API_TOKEN` is not set for release builds.
3. Increment `IOS_BUILD_NUMBER` and `ANDROID_VERSION_CODE`.
4. Confirm `package.json` version matches the intended public release version.
5. Capture fresh App Store and Google Play screenshots from the release candidate build.
6. Publish the privacy policy and support docs at public URLs.
7. Prepare App Review and Play Console test credentials or token-based reviewer instructions.
8. Run `npm run release:check`, `npm run expo:config`, `npm run doctor`, `npm run lint`, `npm run typecheck`, and `npm test`.
9. Run `npm run build:ios:production` and `npm run build:android:production`.
10. Submit through EAS or the store consoles after build verification.

## External blockers that still require humans

- Apple Developer team assignment and signing credentials.
- Google Play Console service account / upload credentials.
- Public privacy policy URL.
- Public support URL or support email landing page.
- Final production backend URLs.
- Reviewer credentials or token-based instructions for authenticated app flows.
