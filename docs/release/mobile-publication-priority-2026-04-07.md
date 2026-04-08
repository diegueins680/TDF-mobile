# Mobile Publication Priority Reset — 2026-04-07

Primary company goal: publish the TDF mobile app on the App Store and Google Play end-to-end.

## Active company lanes
1. **Packet A — Mobile Login-Proof Release Lane**
   - Prove username/password and Google login work properly on the real release lane.
   - Fix login blockers first.
2. **Packet B — Mobile Store-Publish Execution**
   - Once Packet A is proven, drive App Store / Play publication to completion.
   - Escalate only for strict operator actions.
3. **Lane C — Evergreen Continuous Improvement Loop**
   - Permanent supporting lane, never displacing Packet A or Packet B.

## Sequencing
- Packet A remains the gate for truthful release readiness.
- As soon as Packet A is proven, Packet B becomes the top execution lane and should proceed until store publication is complete or blocked by Apple/Google/operator-only action.
- Testing/reviewer setup stays narrow and only supports actual release execution.

## Known live store state at reset
- App Store Connect app review page is open and interactive.
- Google Play dashboard is open and interactive.
- Prior mobile engineering work already landed auth- and reviewer-related fixes in `tdf-mobile`.
- Current org priority is no longer Meta; mobile publication supersedes it.
