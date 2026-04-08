# Mobile Release War Room — 2026-04-06

## Primary company goal
Publish the TDF mobile app on both the App Store and Play Store.

## Sequencing rule (hard gate)
Before any testing setup, reviewer/test-access setup, or broader systems/testing work:
1. Prove mobile login works correctly on the real release lane.
2. Fix login blockers first.
3. Only then enable the narrow testing/reviewer setup that directly supports store publication.

## Active packets
### Packet A — Login-proof release lane
Goal: prove username/password login (and Google login where configured) works on the real release candidate lane.
Included work:
- release build auth validation
- release-lane login confirmation
- auth blocker fixes only

### Packet B — Store publish readiness
Goal: move iOS and Android to publishable store state after login proof.
Included work:
- App Store corrected binary / submission readiness
- Play Console production-access path / first-store-submission requirements
- only the store-side steps that directly unblock publication

## Direct-report objective rewrite
### CTO
Drive Platform + Release on login correctness first, then store-publish readiness.
- Keep engineering focused on release-lane login correctness and store blockers.
- Pause unrelated feature work unless it directly blocks mobile publish.
- Do not expand testing/reviewer setup until login is proven on the release lane.

### CIO
Keep systems/testing paused until login is proven.
- Do not broaden test/reviewer setup before release-lane login proof.
- After login is proven, enable only the narrow testing setup that directly supports store release.
- Reject unrelated testing/admin churn.

### Platform
- Prioritize auth correctness in release builds.
- Keep release artifacts/builds flowing.
- Ignore non-publish lanes unless they unblock login proof or store submission.

### Release
- Drive App Store / Play Console actions only after login proof is satisfied.
- Capture exact external blockers from Apple/Google when encountered.

## Current proof/blocker snapshot
- Real release-lane login proof is not yet complete.
- iOS: fixed binary built and current App Store item is waiting for review, but corrected-build ingestion/submission is not yet confirmed on the live App Store lane, so release-lane login proof is still unproven.
- Android: internal testing manual publish succeeded, but Google still blocks first Play Store submission because production access is not yet granted (`You don't have access to production yet`), so real store-lane login proof is still unproven.

## Paused lanes
- reviewer/test-access setup beyond minimum release need
- unrelated product work
- non-mobile publication lanes
