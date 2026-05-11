# Release Readiness — Go / No-Go

| Item | Status | Last Verified | Evidence / Blocker |
|---|---|---|---|
| Username/password auth | ✅ PROVEN | 2026-05-10 | `evidence/release-auth-submit-20260509-2126.png` |
| Google OAuth backend | ✅ FIXED | 2026-05-10 | `GOOGLE_CLIENT_ID` set; endpoint returns 401 for bad tokens (alive) |
| Google OAuth e2e | ⏳ BLOCKED | — | Needs real ID token or Detox automation (`SIMULATOR_SYSTEM_DIALOG_BLOCKED`) |
| Post-login 403 | ✅ FIXED | 2026-05-10 | `Manager` role added to test account party 33 |
| Lane health | ✅ UP | 2026-05-11 | `check-lane-status.sh` EXIT_CODE=0 |
| Detox build | 🔄 IN PROGRESS | 2026-05-11 | Root cause (DB lock) fixed; build compiling with fresh DerivedData |
| Dev auto-fill retirement | ⏳ GATED | — | Gate: Detox proves real text-input automation |

## Gated Conditions for Shippable Build

1. **Google OAuth e2e proven** — real token POST to `/login/google` returns 200, OR manual device test recorded.
2. **Detox smoke test passes** — `npx detox test --configuration ios.sim.debug` exits 0.
3. **Auto-fill removed** — delete `__DEV__` pre-fill block in `app/auth.tsx` (gate 2 must pass first).
4. **RC regression clean** — run Priority 2 regression (login → parties load → no 403).

## Active Blockers

| Blocker | Owner | Fix |
|---|---|---|
| `XCODE_CLT_OUTDATED` | operator | `sudo rm -rf /Library/Developer/CommandLineTools && sudo xcode-select --install` |
| `SIMULATOR_SYSTEM_DIALOG_BLOCKED` | tdf-label-platform | Detox setup + real device or token test |

## RC Verdict

`CONDITIONAL-GO` — Username/password auth proven, backend healthy. Google OAuth and Detox automation remain open before shipping.
