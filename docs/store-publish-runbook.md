# Store Publish Runbook — TDF Records Mobile App

Last verified: 2026-11-13. This replaces the May EAS-first instructions.

## Identity and release scope

- iOS: `com.tdfrecords.app`; App Store Connect app ID `6779786470`.
- Android: `com.tdf.records`.
- Marketing version in source: `1.0.1`; confirm the intended version against both stores.
- Release API: `https://api.tdfrecords.net`; upload: `/drive/upload` on that host.
- [Release setup](release.md) describes the signed GitHub workflows and artifact guards.

Agree on the candidate commit, included features, store track, countries and rollout
before production. Keep Apple release MANUAL and Android release under operator
control. Build success, upload, processing, testing availability, review approval
and public release are separate states; record each independently.

## Evidence checked on 2026-11-13

- Main: `11e786dee54c8cb08eed741b4a6e1edaf5ab2883`.
  [Mobile Validate 43348381271](https://github.com/diegueins680/TDF-mobile/actions/runs/43348381271)
  passed release checks, Jest, signing/artifact guard tests and Expo Doctor.
  [Synthetic 43348381116](https://github.com/diegueins680/TDF-mobile/actions/runs/43348381116)
  also passed. These are source/automated checks, not device qualification.
- Local audit on that main plus these documentation changes, Node 20.19.4:
  release:check passed; Jest passed 831 tests/106 suites; artifact-guard tests
  passed 17 with 1 macOS-only skip. Expo Doctor passed 15/17 locally; Expo schema
  lookup failed with EAI_AGAIN for exp.host and Directory lookup failed with an
  unexpected server response. This local Doctor run is not a pass; the hosted
  same-source Doctor result above is separate evidence. Metro reached its ready
  log offline and was stopped; a separate-process HTTP probe could not connect.
- Production dependency audit reported 38 affected packages (8 high, 19 moderate,
  11 low), including direct Zod below 4.6.6. PR #166 proposes 4.6.7 but is still a
  draft and behind main. Evaluate and integrate dependency fixes through normal
  review; a green source build does not clear the advisory findings.
- Latest signed workflows found in the 100 most recent manual runs:
  [iOS 37325937942](https://github.com/diegueins680/TDF-mobile/actions/runs/37325937942)
  and [Android 37325943662](https://github.com/diegueins680/TDF-mobile/actions/runs/37325943662),
  both successful on 2026-10-05 at `6ebe6c5fee3efb8712c673f102c44ec4913710e2`.
  Both artifact APIs now return empty lists; no downloadable candidate was verified.
  These runs do not qualify the current main commit or establish store submission.
- September iOS25 / Android17 receipts in release.md are historical. Current used
  numbers, review decisions, tester eligibility and production state remain unverified.
- This audit's cloud browser reached Apple login with `authResult=FAILED`.
  Google Play inspection was blocked by browser approval review. Neither console
  was audited. No signing material was extracted and no store mutation occurred.
- Public privacy, support, terms and data-deletion URLs returned HTTP403 from
  this cloud environment on 2026-11-13. Reachability for store reviewers remains
  unverified; this observation does not establish a global outage.
- Physical-device Google login on the final candidate remains a production gate.
  Existing simulator screenshots and a Google consent dialog are not a full login.

## Before dispatching a signed build

1. Inspect App Store Connect and Google Play Console with the authorized account.
   Record latest used build numbers/version codes, review messages, account status,
   release mode and the existing testing track. Choose unused numbers there; do
   not infer them from this document, workflow history or EAS remote counters.
2. Confirm the exact main SHA and release scope. Resolve required PRs through the
   normal protected review process, then repeat checks on the resulting candidate.
   Do not silently include every pending feature or bypass conflicts/checks.
3. With Node from `.nvmrc`, run `npm ci`, `npm run release:check`, `npm test -- --watch=false`,
   `npm run doctor`, and the existing signing/artifact guard tests. Preserve native
   simulator/Android CI gates and deployment-mode lockfile checks.
4. Check current store SDK requirements and the actual artifact, not only source
   configuration. Recheck screenshots, age/content rating, privacy/data safety,
   account deletion, review contact and working reviewer instructions. Confirm the
   public legal/support pages are reachable and accurately describe the candidate.
5. Use existing signing environments and credentials. Stop for any new purchase,
   agreement or access/security change requiring separate authorization.

## Build, qualify and submit

From an authenticated GitHub CLI, with store-verified unused numbers:

```bash
npm run build:ios:production -- -f build_number=UNUSED_IOS_NUMBER
npm run build:android:production -- -f version_code=UNUSED_ANDROID_NUMBER
```

These dispatch `main`, not the local checkout. Record the resolved source SHA and
run ID. Do not run competing EAS/GitHub build lanes. Download each exact qualified
artifact promptly: retention is one day. Verify its SHA256/source/run receipt,
identity, version, signature and embedded production API with the existing gates.
Do not use EAS `--latest` to select an artifact produced by GitHub.

Upload the verified IPA/AAB through the existing authorized Apple/Play process.
Record processing and validation separately from review submission. Check the
actual selected build/version/track before any submit action. Preserve MANUAL
Apple release; EAS Android configuration (`internal` + `draft`) is only a default,
not evidence of the actual Play track or availability. Synchronize legacy EAS
remote numbering after a qualified build succeeds, without starting another build.

## Device and production gates

- On the exact candidate, record device model, OS, build number, source/hash,
  date, tester and result. Test fresh install and upgrade, password login, complete
  Google login/callback, logout and cold restart, account switching, and production
  API/upload behavior. Cover affected payment, notification, deep-link and media flows.
- Use [the Google login checklist](google-oauth-manual-test.md) as historical flow
  guidance, adapting UI expectations to the current native Google sign-in. Do not
  treat its old localhost/backend or browser-dialog assumptions as release evidence.
- Verify Play production access and any applicable closed-test requirement in the
  account. Preserve existing testers/invitations; elapsed calendar time alone does
  not establish 12 testers continuously opted in for 14 days.
- Capture current store review outcomes. Release production only after the above
  gates pass and the concrete rollout scope is authorized. No automatic release.

## Current policy references

Checked 2026-11-13; recheck before submission:

- [Apple requirements](https://developer.apple.com/news/upcoming-requirements/):
  Xcode 26/iOS 26 SDK minimum since April 2026. The current workflow pins Xcode 26.2;
  actual archive validation remains required. Apple's [submission page](https://developer.apple.com/app-store/submitting/)
  separately announces SDK 27 requirements starting April 2027.
- [Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878):
  new phone apps/updates require API 36 from August 2026; inspect the final AAB.
- [Play personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465):
  qualifying accounts need at least 12 continuously opted-in closed testers for 14 days
  before applying for production access. Account-specific eligibility is unverified.

## Recovery and receipts

Retain source SHA, run IDs, artifact hashes, store build IDs, review results and
physical test evidence without credentials or personal test data. If a rollout
fails, pause further rollout where supported and prepare a tested corrective build
with a new store-verified number. Do not promise an iOS downgrade to a previous
binary; store recovery options must be verified in the console.
