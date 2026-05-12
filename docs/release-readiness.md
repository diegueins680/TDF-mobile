# Release Readiness — Go / No-Go

| Item | Status | Last Verified | Evidence / Blocker |
|---|---|---|---|
| Username/password auth | ✅ REGRESSION PASSED | 2026-05-11 | `evidence/release-regression-postclick3-20260511-0139.png` (fresh install, no 403, parties list loaded) |
| Google OAuth backend | ✅ FIXED | 2026-05-10 | `GOOGLE_CLIENT_ID` set; endpoint returns 401 for bad tokens (alive) |
| Google OAuth e2e | ⏳ DEFERRED | 2026-05-11 | Backend fully ready (`GOOGLE_CLIENT_ID` set, `/login/google` returns 401 for bad tokens). Frontend e2e blocked on `LOGIN_TESTID_NOT_VISIBLE` (pending iOS rebuild) + `MAESTRO_JAVA_MISSING`. Manual test plan (`docs/google-oauth-manual-test.md`) exists as fallback. |
| Post-login 403 | ✅ FIXED + SEED FIXED | 2026-05-11 | `Manager` role added to test account party 33; `TDF.Seed.hs` now explicitly upserts `Manager` for `tdf-owner` |
| Lane health | ✅ UP | 2026-05-11 | `check-lane-status.sh` EXIT_CODE=0 |
| Detox launchApp | ✅ RESOLVED | 2026-05-11 | `detoxDisableSynchronization: true` via `launchArgs` fixes timeout. Owner: tdf-label-platform. |
| iOS app binary | ✅ RESOLVED | 2026-05-11 | `.detoxrc.js` `binaryPath` corrected to `tdf-mobile/ios/build/Build/Products/Debug-iphonesimulator/TDFRecords.app`. Valid `CFBundleIdentifier` confirmed. Owner: tdf-label-platform. |
| Backend binary | ✅ RESOLVED | 2026-05-11 | Platform rebuilt with `stack build` (ghc-9.6.6); restarted. POST /login returns 200 + token. Owner: tdf-label-platform. |
| Detox login test | 🔨 REBUILD IN PROGRESS | 2026-05-12 | Root cause: STALE_BINARY — iOS binary (mtime 2026-05-10) predates testID additions to auth.tsx/onboarding.tsx. `npx detox build --configuration ios.sim.debug` running (xcodebuild PID 10563). Owner: tdf-label-platform. |
| Maestro install | ✅ INSTALLED | 2026-05-11 | Maestro CLI installed to `~/.maestro/bin`. Java runtime required to run. Owner: operator. |
| Dev auto-fill retirement | ⏳ GATED | — | Gate: Detox proves real text-input automation |

## Gated Conditions for Shippable Build

1. **Google OAuth e2e proven** — real token POST to `/login/google` returns 200, OR manual device test recorded PASS in `docs/google-oauth-manual-test.md` sign-off table.
2. **Detox smoke test passes** — `npx detox test --configuration ios.sim.debug` exits 0.
3. **Auto-fill removed** — delete `__DEV__` pre-fill block in `app/auth.tsx` (gate 2 must pass first).
4. **RC regression clean** — run Priority 2 regression on simulator `8DB9DCE0-2F80-49C9-A614-F21DA3876B7B` (login → parties load → no 403).

## Active Blockers

| Blocker | Owner | Fix |
|---|---|---|
| `XCODE_CLT_OUTDATED` | operator | `sudo rm -rf /Library/Developer/CommandLineTools && sudo xcode-select --install` |
| `LOGIN_TESTID_NOT_VISIBLE` | tdf-label-platform | Root cause identified: STALE_BINARY. Fix: wait for `npx detox build` (PID 10563) to complete, then re-run `npx detox test --configuration ios.sim.debug --reuse`. |

| `MAESTRO_JAVA_MISSING` | operator | `brew install --cask temurin` requires sudo password. Alternative: download Eclipse Temurin `.pkg` manually from https://adoptium.net and install, or use `sdkman`/`jabba` user-local install. Then `export PATH="$PATH":"$HOME/.maestro/bin" && maestro test tdf-mobile/e2e/auth-flow.yaml` |
| `SIMULATOR_SYSTEM_DIALOG_BLOCKED` | tdf-label-platform | Detox setup + real device or token test |

## RC Verdict

`CONDITIONAL-GO` — Username/password auth proven + regression passed on fresh install. Backend fully ready (`/login` and `/login/google` both alive). iOS binary rebuild in progress to resolve `LOGIN_TESTID_NOT_VISIBLE`. Once rebuild completes, Detox can prove login e2e and Google OAuth e2e. Google OAuth e2e remains the last open gate before shippable testing version.

---

_Revision history:_
- 2026-05-11 — Release Director: iOS app binary marked RESOLVED per Platform fix; `LOGIN_TESTID_NOT_VISIBLE` added as active blocker; `MAESTRO_JAVA_MISSING` updated with sudo note and adoptium.net fallback. _(tdf-label-release)_
- 2026-05-11 — Release Director: updated username/password to REGRESSION PASSED, post-login 403 to FIXED + SEED FIXED, gated condition 4 with simulator ID. _(tdf-label-release)_
- 2026-05-10 — Release Director: initial go/no-go table created. _(tdf-label-release)_
