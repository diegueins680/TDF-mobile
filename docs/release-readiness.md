# Release Readiness — Go / No-Go

| Item | Status | Last Verified | Evidence / Blocker |
|---|---|---|---|
| Username/password auth | ✅ REGRESSION PASSED | 2026-05-11 | `evidence/release-regression-postclick3-20260511-0139.png` (fresh install, no 403, parties list loaded) |
| Google OAuth backend | ✅ FIXED | 2026-05-10 | `GOOGLE_CLIENT_ID` set; endpoint returns 401 for bad tokens (alive) |
| Google OAuth e2e | ⏳ DEFERRED | 2026-05-11 | Manual test plan created (`docs/google-oauth-manual-test.md`); awaits operator execution on physical device. Detox blocked by `DETOX_LAUNCHAPP_TIMEOUT`. |
| Post-login 403 | ✅ FIXED + SEED FIXED | 2026-05-11 | `Manager` role added to test account party 33; `TDF.Seed.hs` now explicitly upserts `Manager` for `tdf-owner` |
| Lane health | ✅ UP | 2026-05-11 | `check-lane-status.sh` EXIT_CODE=0 |
| Detox build | ❌ BLOCKED | 2026-05-11 | `DETOX_LAUNCHAPP_TIMEOUT`: `device.launchApp()` exceeds 120s, main queue continuously busy. Owner: tdf-label-platform. |
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
| `DETOX_LAUNCHAPP_TIMEOUT` | tdf-label-platform | Investigate Metro bundle speed, pre-bundle JS with `expo export:embed`, or switch to Maestro |
| `MAESTRO_JAVA_MISSING` | operator | Install Java runtime (e.g. `brew install openjdk@17` or download from java.com). Then `export PATH="$PATH":"$HOME/.maestro/bin" && maestro test tdf-mobile/e2e/auth-flow.yaml` |
| `SIMULATOR_SYSTEM_DIALOG_BLOCKED` | tdf-label-platform | Detox setup + real device or token test |

## RC Verdict

`CONDITIONAL-GO` — Username/password auth proven + regression passed on fresh install, backend healthy. Google OAuth e2e and Detox automation remain open before shipping.

---

_Revision history:_
- 2026-05-11 — Release Director: Google OAuth e2e DEFERRED with manual test plan; Detox build marked BLOCKED on `DETOX_LAUNCHAPP_TIMEOUT`. _(tdf-label-release)_
- 2026-05-11 — Release Director: updated username/password to REGRESSION PASSED, post-login 403 to FIXED + SEED FIXED, gated condition 4 with simulator ID. _(tdf-label-release)_
- 2026-05-10 — Release Director: initial go/no-go table created. _(tdf-label-release)_
