# Store Submission Checklist

## Repo-complete items

- Stable Expo config lives in `app.config.ts`.
- iOS bundle identifier: `com.tdfrecords.app`.
- Android application ID: `com.tdf.records`.
- Store assets are generated under `assets/`.
- EAS build profiles live in `eas.json`.
- Release environment validation lives in `scripts/release-check.mjs`.
- Store metadata and legal templates live in this folder.
- Public support page: `https://www.tdfrecords.net/mobile-app/support.html`
- Public privacy policy: `https://www.tdfrecords.net/mobile-app/privacy.html`
- Public terms page: `https://www.tdfrecords.net/mobile-app/terms.html`
- Public data deletion page: `https://www.tdfrecords.net/mobile-app/data-deletion.html`

## Before the next store upload

1. Confirm `EXPO_PUBLIC_API_TOKEN` is not set for `preview` or `production` builds.
2. Confirm `package.json` version matches the intended public release version.
3. Capture fresh App Store and Google Play screenshots from the release candidate build.
4. Verify the published support and legal pages are reachable and match the store listing URLs.
5. Prepare App Review and Play Console test credentials or token-based reviewer instructions.
6. Verify the existing App Store Connect review contact card directly in the authorized console; do not copy personal contact details into public release evidence.
7. Run `npm run release:check`, `npm run doctor`, and `npm test`.
8. Follow the [current store runbook](../store-publish-runbook.md): verify unused numbers in both stores, then dispatch main with explicit `build_number` / `version_code`.
9. Qualify and upload the exact artifact from that run; never select a GitHub artifact with EAS `--latest`. Record processing, testing availability and review separately.
10. Complete physical-device qualification and verify production eligibility and rollout scope before manual production release.

## External blockers that still require humans

- Google Play Console service account / upload credentials if Android submission should happen through EAS.
- Reviewer credentials or token-based instructions for authenticated app flows.
- Final privacy/data-safety sign-off.
- Final screenshots from the release-candidate builds.
- Store-console account access / credential handoff for the chosen Android and iOS submission path.
