# Release Readiness — Go / No-Go

| Item | Status | Last Verified | Evidence / Blocker |
|---|---|---|---|
| Username/password auth | ✅ REGRESSION PASSED | 2026-05-11 | `evidence/release-regression-postclick3-20260511-0139.png` (fresh install, no 403, parties list loaded) |
| Google OAuth backend | ✅ VERIFIED | 2026-05-12 | `GOOGLE_CLIENT_ID` set; `POST /login/google` with fake token returns 401 `Tu sesión de Google es inválida o expiró.` Backend fully ready. |
| Google OAuth e2e | ⏳ DEFERRED | 2026-05-12 | Backend fully ready (`GOOGLE_CLIENT_ID` set, `/login/google` returns 401 for bad tokens). `LOGIN_TESTID_NOT_VISIBLE` RESOLVED. Frontend e2e now blocked on `SIMULATOR_SYSTEM_DIALOG_BLOCKED` (ASWebAuthenticationSession dialog not dismissible via AppleScript/Detox) + `MAESTRO_JAVA_MISSING`. Manual test plan (`docs/google-oauth-manual-test.md`) exists as fallback. |
| Post-login 403 | ✅ FIXED + SEED FIXED | 2026-05-11 | `Manager` role added to test account party 33; `TDF.Seed.hs` now explicitly upserts `Manager` for `tdf-owner` |
| Lane health | ✅ UP | 2026-05-11 | `check-lane-status.sh` EXIT_CODE=0 |
| Detox launchApp | ✅ RESOLVED | 2026-05-11 | `detoxDisableSynchronization: true` via `launchArgs` fixes timeout. Owner: tdf-label-platform. |
| iOS app binary | 🔨 REBUILD IN PROGRESS | 2026-05-12 | xcodebuild PID 88382 direct build running since ~05:00 UTC. Binary mtime still May 11 19:50. Owner: tdf-label-platform. |
| Backend binary | ✅ READY | 2026-05-12 | Fresh stack-built binary started (PID 95241). Migrations completed. `POST /login/google` returns 401 for fake tokens. Backend fully ready. Owner: tdf-label-release. |
| Detox login test | ✅ PASSED | 2026-05-12 | Fresh binary (mtime 2026-05-11 19:50) contains testIDs. `npx detox test --configuration ios.sim.debug --reuse e2e/firstTest.e2e.js` PASS in 13.1s. Login flow automated end-to-end. Owner: tdf-label-release. |
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
| `LOGIN_TESTID_NOT_VISIBLE` | tdf-label-release | RESOLVED — fresh binary verified; Detox login test passes. |

| `MAESTRO_JAVA_MISSING` | operator | `brew install --cask temurin` requires sudo password. Alternative: download Eclipse Temurin `.pkg` manually from https://adoptium.net and install, or use `sdkman`/`jabba` user-local install. Then `export PATH="$PATH":"$HOME/.maestro/bin" && maestro test tdf-mobile/e2e/auth-flow.yaml` |
| `SIMULATOR_SYSTEM_DIALOG_BLOCKED` | tdf-label-platform | Detox setup + real device or token test |

## Ship Gate — Google OAuth e2e

**Status:** ⏳ OPEN — sole remaining blocker for testing version.

**Three parallel paths (all currently blocked except manual):**
1. **Real token + curl** — blocked: no programmatic token source available in environment.
2. **Detox simulator automation** — blocked: `SIMULATOR_SYSTEM_DIALOG_BLOCKED` (ASWebAuthenticationSession dialog not dismissible via Detox). May improve with iOS 18.4+ or Detox updates.
3. **Maestro simulator automation** — blocked: `MAESTRO_JAVA_MISSING` (Temurin install requires sudo).
4. **Manual physical device test** — UNBLOCKED. Plan exists at `docs/google-oauth-manual-test.md`. Needs operator assignment and execution.

**Immediate next action:**
- Operator: install app on physical iPhone → execute `docs/google-oauth-manual-test.md` steps 1-7 → sign off in doc's sign-off table → notify tdf-label-release.
- Expected execution time: 5-10 minutes.
- If PASS: update this doc to `TESTING-VERSION-READY`.
- If FAIL: record exact fail criterion, screenshot, and owner in `google-oauth-manual-test.md`.

## RC Verdict

`CONDITIONAL-GO` — Username/password auth proven + regression passed on fresh install + Detox login test PASS. Backend configured and restarting (migrations running). iOS rebuild in progress. Google OAuth e2e is the **sole open ship gate**. Manual device test is the only unblocked near-term path.

---

_Revision history:_
- 2026-05-12 — Release Director: `Backend binary` marked 🔨 RESTARTING (migrations running); `iOS app binary` marked 🔨 REBUILD IN PROGRESS; added `Ship Gate — Google OAuth e2e` section with manual test as unblocked path. _(tdf-label-release)_
- 2026-05-12 — Release Director: `Detox login test` marked ✅ PASSED; `LOGIN_TESTID_NOT_VISIBLE` moved to resolved; `Google OAuth e2e` updated to reflect new blocker `SIMULATOR_SYSTEM_DIALOG_BLOCKED`; gated condition 2 updated with PASS evidence. _(tdf-label-release)_
- 2026-05-11 — Release Director: iOS app binary marked RESOLVED per Platform fix; `LOGIN_TESTID_NOT_VISIBLE` added as active blocker; `MAESTRO_JAVA_MISSING` updated with sudo note and adoptium.net fallback. _(tdf-label-release)_
- 2026-05-11 — Release Director: updated username/password to REGRESSION PASSED, post-login 403 to FIXED + SEED FIXED, gated condition 4 with simulator ID. _(tdf-label-release)_
- 2026-05-10 — Release Director: initial go/no-go table created. _(tdf-label-release)_
