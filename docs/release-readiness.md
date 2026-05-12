# Release Readiness — Go / No-Go

| Item | Status | Last Verified | Evidence / Blocker |
|---|---|---|---|
| Username/password auth | ✅ REGRESSION PASSED | 2026-05-11 | `evidence/release-regression-postclick3-20260511-0139.png` (fresh install, no 403, parties list loaded) |
| Google OAuth backend | ✅ VERIFIED | 2026-05-12 | `GOOGLE_CLIENT_ID` set; `POST /login/google` with fake token returns 401 `Tu sesión de Google es inválida o expiró.` Backend fully ready. |
| Google OAuth e2e | ⏳ DEFERRED | 2026-05-12 | Backend fully ready (`GOOGLE_CLIENT_ID` set, `/login/google` returns 401 for bad tokens). `LOGIN_TESTID_NOT_VISIBLE` RESOLVED. Frontend e2e now blocked on `SIMULATOR_SYSTEM_DIALOG_BLOCKED` (ASWebAuthenticationSession dialog not dismissible via AppleScript/Detox) + `MAESTRO_JAVA_MISSING`. Manual test plan (`docs/google-oauth-manual-test.md`) exists as fallback. |
| Post-login 403 | ✅ FIXED + SEED FIXED | 2026-05-11 | `Manager` role added to test account party 33; `TDF.Seed.hs` now explicitly upserts `Manager` for `tdf-owner` |
| Lane health | ✅ UP | 2026-05-11 | `check-lane-status.sh` EXIT_CODE=0 |
| Detox launchApp | ✅ RESOLVED | 2026-05-11 | `detoxDisableSynchronization: true` via `launchArgs` fixes timeout. Owner: tdf-label-platform. |
| iOS app binary | ✅ RESOLVED | 2026-05-12 | Fresh binary built successfully (mtime 2026-05-12 01:40:35). `CFBundleIdentifier` verified as `com.tdfrecords.app`. Owner: tdf-label-platform. |
| Backend binary | ✅ READY | 2026-05-12 | Fresh stack-built binary started (PID 95241). Migrations completed. `POST /login/google` returns 401 for fake tokens. Backend fully ready. Owner: tdf-label-release. |
| Detox login test | ✅ PASSED | 2026-05-12 | `device.clearKeychain()` in `beforeAll` resolves keychain persistence. `firstTest.e2e.js` username/password flow PASS (13.1s). Owner: tdf-label-platform (commit `31dd61b`). |
| Maestro install | ✅ INSTALLED | 2026-05-11 | Maestro CLI installed to `~/.maestro/bin`. Java runtime required to run. Owner: operator. |
| Dev auto-fill retirement | ⏳ GATED | — | Gate: Detox proves real text-input automation |

## Gated Conditions for Shippable Build

1. **Google OAuth e2e proven** — real token POST to `/login/google` returns 200, OR manual device test recorded PASS in `docs/google-oauth-manual-test.md` sign-off table.
2. **Detox smoke test passes** — `npx detox test --configuration ios.sim.debug` exits 0. ✅ `firstTest.e2e.js` PASS 2026-05-12.
3. **Auto-fill removed** — delete `__DEV__` pre-fill block in `app/auth.tsx` (gate 2 must pass first).
4. **RC regression clean** — run Priority 2 regression on simulator `8DB9DCE0-2F80-49C9-A614-F21DA3876B7B` (login → parties load → no 403).

## Active Blockers

| Blocker | Owner | Fix |
|---|---|---|
| `XCODE_CLT_OUTDATED` | operator | `sudo rm -rf /Library/Developer/CommandLineTools && sudo xcode-select --install` |
| `MAESTRO_JAVA_MISSING` | operator | `brew install --cask temurin` requires sudo password. Alternative: download Eclipse Temurin `.pkg` manually from https://adoptium.net and install, or use `sdkman`/`jabba` user-local install. Then `export PATH="$PATH":"$HOME/.maestro/bin" && maestro test tdf-mobile/e2e/auth-flow.yaml` |
| `SIMULATOR_SYSTEM_DIALOG_BLOCKED` | tdf-label-platform | ASWebAuthenticationSession "Continue" dialog blocks automated Google OAuth completion on simulator. Fix: real device test, or attempt Maestro/Detox system-dialog handling. |

## Ship Gate — Google OAuth e2e

**Status:** ⏳ OPEN — sole remaining blocker for testing version.

**What is the one thing preventing shipping?**
> Google OAuth full end-to-end proof (web sign-in → token → callback → post-login screen) has not been demonstrated.

**Four parallel paths:**
1. **Real token + curl** — blocked: no programmatic token source available in environment.
2. **Detox simulator automation** — `SIMULATOR-REALISTIC PASS` (2026-05-12): test proves button tap triggers ASWebAuthenticationSession system alert. Full web-sign-in completion blocked by system dialog on simulator (expected limitation).
3. **Maestro simulator automation** — blocked: `MAESTRO_JAVA_MISSING` (Temurin install requires sudo).
4. **Manual physical device test** — UNBLOCKED. Plan exists at `docs/google-oauth-manual-test.md`. Needs operator assignment and execution.

**Immediate next action (operator/CTO):**
- Option A (fastest, 5-10 min): Install existing `.app` on physical iPhone → execute `docs/google-oauth-manual-test.md` steps 1-7 → sign off in doc's sign-off table → notify tdf-label-release.
- Option B (10-15 min): Run `brew install --cask temurin`, enter sudo password → `export PATH="$PATH":"$HOME/.maestro/bin" && maestro test tdf-mobile/e2e/auth-flow.yaml`.
- Option C (20-30 min): Install gcloud SDK → authenticate → obtain real Google ID token → `curl -X POST http://localhost:8080/login/google -d '{"idToken":"<token>"}'` → verify 200 + session.

**If PASS:** Update this doc to `TESTING-VERSION-READY` and proceed to `eas build --profile preview` command.
**If FAIL:** Record exact fail criterion, screenshot, and owner in `google-oauth-manual-test.md`.

## RC Verdict

`CONDITIONAL-GO` — Username/password auth proven + Detox automated login PASS. Backend fully ready. iOS binary resolved. Detox login test PASS (keychain clear fix applied). Google OAuth simulator-realistic test PASS (flow starts, system dialog presents). Full Google OAuth e2e (through web sign-in to post-login) remains the **sole open ship gate**. Manual device test is the only unblocked near-term path.

---

_Revision history:_
- 2026-05-12 — Release Director: Token acquisition sweep completed (all automated paths blocked); `Ship Gate` updated with one-sentence blocker statement and three operator options (manual test / Maestro / gcloud); highest-risk failure documented as P0 Google-login production risk. _(tdf-label-release)_
- 2026-05-12 — Release Director: `Detox login test` marked ✅ PASSED (keychain clear fix verified); `DETOX_ACCESSIBILITY_MATCHER_FAILURE` removed from active blockers; Google OAuth e2e updated to `SIMULATOR-REALISTIC PASS`; `Ship Gate` path 2 updated. _(tdf-label-release)_
- 2026-05-12 — Release Director: `iOS app binary` marked ✅ RESOLVED; `Detox login test` marked ⚠️ INTERMITTENT; replaced `LOGIN_TESTID_NOT_VISIBLE` with `DETOX_ACCESSIBILITY_MATCHER_FAILURE`; updated `SIMULATOR_SYSTEM_DIALOG_BLOCKED` fix note. _(tdf-label-release)_
- 2026-05-12 — Release Director: `Detox login test` marked ✅ PASSED; `LOGIN_TESTID_NOT_VISIBLE` moved to resolved; `Google OAuth e2e` updated to reflect new blocker `SIMULATOR_SYSTEM_DIALOG_BLOCKED`; gated condition 2 updated with PASS evidence. _(tdf-label-release)_
- 2026-05-11 — Release Director: iOS app binary marked RESOLVED per Platform fix; `LOGIN_TESTID_NOT_VISIBLE` added as active blocker; `MAESTRO_JAVA_MISSING` updated with sudo note and adoptium.net fallback. _(tdf-label-release)_
- 2026-05-11 — Release Director: updated username/password to REGRESSION PASSED, post-login 403 to FIXED + SEED FIXED, gated condition 4 with simulator ID. _(tdf-label-release)_
- 2026-05-10 — Release Director: initial go/no-go table created. _(tdf-label-release)_
