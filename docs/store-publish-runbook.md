# Store Publish Runbook — TDF Records Mobile App

**Owner:** tdf-label-release  
**Manager:** tdf-label-cto  
**Last updated:** 2026-05-27  
**Scope:** One complete App Store + Google Play submission cycle, start to finish.

---

## Step-by-Step

| Step | Action | Owner | Verification Command / Evidence |
|------|--------|-------|--------------------------------|
| 1 | **Version bump** — confirm `package.json` version matches intended public release. | tdf-label-release | `node -p "require('./package.json').version"` |
| 2 | **Release check** — lint, typecheck, release script, Expo config. | tdf-label-release | `npm run release:check` (must exit 0) |
| 3 | **Expo Doctor** — catch native-module / SDK mismatches. | tdf-label-release | `npx expo-doctor` (must exit 0) |
| 4 | **Detox regression** — both login paths PASS on `ios.sim.release`. | tdf-label-release | `npx detox test --configuration ios.sim.release e2e/firstTest.e2e.js` (must exit 0) |
| 5 | **iOS production build** — EAS cloud build with `autoIncrement`. | tdf-label-cto / operator | `npx eas-cli@latest build --platform ios --profile production` → wait for `FINISHED` |
| 6 | **Android production build** — EAS cloud build with `autoIncrement`. | tdf-label-cto / operator | `npx eas-cli@latest build --platform android --profile production` → wait for `FINISHED` |
| 7 | **Screenshot capture** — fresh App Store + Google Play screenshots from RC builds. | tdf-label-cto / operator | Manual; archive to `evidence/store-screenshots-YYYY-MM-DD/` |
| 8 | **iOS submit** — EAS submit to App Store Connect (`ascAppId: 6754828747`). | tdf-label-cto / operator | `npx eas-cli@latest submit --platform ios --profile production --latest` |
| 9 | **Android submit** — EAS submit to Google Play internal track (draft). | tdf-label-cto / operator | `npx eas-cli@latest submit --platform android --profile production --latest` |
| 10 | **Post-submit verification** — confirm builds appear in App Store Connect + Play Console. | tdf-label-release | Web console check; screenshot evidence appended to `tdf-label-release.md` |

---

## Pre-Flight Blockers

Resolve these **before** Step 5:

| Blocker | Status | Fix |
|---------|--------|-----|
| `CORESIMULATOR_DEADLOCK` | ❌ ACTIVE — host reboot required | Host has NOT been rebooted for 3+ days; `simctl install` hangs indefinitely. Reboot host, then verify `simctl install` completes in <30s. |
| `EAS_IOS_CREDENTIALS_MISSING` | ❌ ACTIVE | Operator runs `npx eas-cli@latest credentials:configure-build --platform ios --profile preview` interactively. Apple ID login → generate Distribution Certificate + Provisioning Profile for `com.tdfrecords.app`. Verify with `npx eas-cli@latest build --profile preview --platform ios`. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | ❌ ACTIVE | Create Play Console service account + JSON key; add to EAS secrets for Android submission. |
| Physical-device Google OAuth | ⏸️ WAIVED until operator action | Operator review with `.ipa` install. Not blocking simulator testing version. |

---

## Rollback Plan

If a submitted build fails review or crashes in production:

1. **Do not panic.** Both stores support phased releases.
2. **iOS:** Halt rollout in App Store Connect; promote previous build if available.
3. **Android:** Halt rollout in Play Console; promote previous release.
4. **Emergency fix:** Branch from the tagged release SHA, cherry-pick fix, run Steps 2–10 on the hotfix branch.

---

## Evidence Archive

- `evidence/store-screenshots-YYYY-MM-DD/` — store screenshots
- `evidence/store-submission-YYYY-MM-DD/` — submission confirmations
- `tdf-label-release.md` — run-by-run verification log

---

_Revision history:_
- 2026-05-24 — tdf-label-release: initial draft (10 steps, owner + verification per step, pre-flight blockers, rollback plan).
- 2026-05-27 — tdf-label-release: added `CORESIMULATOR_DEADLOCK` to pre-flight blockers; updated all blocker statuses; noted host-reboot requirement and Detox streak break (last PASS 2026-05-25 07:16 UTC).
