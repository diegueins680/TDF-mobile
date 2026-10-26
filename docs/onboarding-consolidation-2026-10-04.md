# Onboarding consolidation and compatibility

Existing PR #71 integrates #46, #47, #48, #51, #54 and #61 with Mobile main `d2fd9399126e3b456c310497fb7d9edba09f981d`. Normal merges retain every original commit. Sources remain open until the successor merges and its resulting tree is verified.

| Source | Retained behavior / current authority | Verification |
|---|---|---|
| #46 `ee3f209` | Server favorites remain authoritative. Current main's account-scoped durable desired-state queue supersedes the old import-only implementation. Snapshots explicitly identify server, cached and pending state; cached queued changes are never described as server confirmation. Authentication/authorization errors do not fall back to cached success. Main's explicit legacy ownership-confirmation import remains; no silent unscoped import. | `savedEvents.test.ts`, EventCard and account-session tests |
| #47 `bc02f52` | Onboarding completion uses server evidence and its actual allowlisted first value. Person follows cannot become artist conversions. Private drafts use account/guest-scoped storage, preserve unread old storage and propagate I/O failures. Published interactions continue using main's canonical InteractionBar; failed public reads never become local feeds. | FirstRunProvider, SocialScreen, eventMoments, firstValueCompletion and canonical InteractionFlows tests |
| #48 `3409aeb`, including `e6cec2c` | Anonymous reaction totals do not invent actor identities. Current generated OpenAPI contracts supersede older event schema prose; public visibility is enforced by the server. | socialApiMapperSanitization, generated client unchanged from main |
| #51 `3b7bf3e`, including `bbd42e8` | Spanish/English saved-state and moment labels, loading/error/retry accessibility, partial saved-detail disclosure and explicit desired reaction state. Main's public feed retry and canonical reaction controls supersede legacy duplicate controls. | EventCardTickets, EventMomentCardReaction, EventDetail and NewUserOnboardingGate suites |
| #54 `c790ab5`, including `f4b37cf`, `a726acd` | Account-owned durable first-value markers survive offline/pending/nonterminal responses. Only confirmed completion clears them. Foreground and reconnect recovery retain main's independent exit queue and conversion retry logic. | onboardingIntent and FirstRunProvider recovery tests |
| #61 `f487de4` | Bodyless server reconciliation on initial/foreground/reconnect load; coalesced in-flight requests; cancellation and session generation guards across A → B → A. Analytics only report a newly completed, valid server value and avoid duplicating the durable experiment conversion owner. | apiClient, usePartyOwnership, FirstRunProvider and NewUserOnboardingGate tests |
| #71 `57abd23` | Public booking Idempotency-Key contract is already present in current main's generated client, alongside approved payment capabilities. Do not restore the smaller historical generated file. | exact generated-client comparison against main/root #414 |

The underlying root formal runner already includes SessionFence, NativeArtistFollow, FanHubOnboarding and WebOnboardingRecovery with negative controls. These finite models complement implementation tests; they do not prove this mobile implementation universally correct. Native behavior and production/provider prerequisites remain separate release gates.

Local merge validation: 89 Jest suites / 586 tests pass; release asset validation, lint, typecheck, release metadata and Expo public-config checks pass. Metro starts and `/status` returns `packager-status:running`. Earlier merge-test failures are retained in external audit logs, including outdated query fixtures corrected for the saved-state snapshot contract. No production deployment or experiment activation is included.

Final session repair also binds reconciliation to the rendered AuthProvider credential and rejects a mismatched global credential before dispatch. Its regression covers eventual recovery after the new account renders. The full suite passes 89/586 after this change; lint and typecheck pass.

After root #414 merged as fdac8e765, Mobile main gained reviewed tester-feedback #127 and generated compatibility #128/#130. This candidate normally merges protected main2b31ed1 and #130, preserving the tester UI and the `/app` registry entry while regenerating API types from current root main. Those API bytes exactly match approved cd3f664; the registry adds the reviewed future `/app` discovery entry from root #479 while retaining the technical payment return. Combined release checks and91Jest suites/590tests pass. Existing rootmain remains pinned at cd3f664 until the coupled successor is approved and merged.

Mobile main subsequently integrated independently approved feedback-category repair #131 as `7a1fca3696dada4263c70716c70b763e492807cc`. This candidate retains it through a normal merge, including the native general-comment classification and submitted-category regressions. Root #479 has now merged as `5efd7ff31d55c1eb5b66b2f7710ea4ef87328727`, pinning #131 source `147ec8bc4ad4150eaab1ad410aa1803822075697`; all approved #414 payment ancestry remains. The older validation counts above describe their respective checkpoints. Current-head results are recorded in the PR and audit; Datadog authorization and release/device prerequisites remain unresolved.

## Local sign-out persistence — 2026-10-26

The AuthProvider from protected main `80d57fd` restored the previous account on
remount when secure-token deletion failed. A regression using the actual provider
and stateful storage adapters reproduces this; it does not simulate a real device
or prove that this storage failure occurred in production.

An identity-free `tdf-auth-logout-intent-v1` marker now blocks restoration from
secure or legacy storage. An unreadable or malformed marker also blocks restore.
Credential writes remain ordered across provider remounts. A successful new
credential write and legacy cleanup must precede removing the marker; failed
replacement never authorizes restoring the older credential.

Existing `setToken` and `clearToken` actions retain their synchronous return
contract and cache/session-epoch behavior. `clearTokenPersisted` separately reports
whether the marker or credential erasure was acknowledged. Auth clears locally
before waiting, Google cleanup cannot delay it, and Spanish/English UI provides
an explicit retry instead of reporting success when persistence is unconfirmed.
The marker contains no account identifier or credential.

This is local sign-out, not server-token revocation. If both storage systems
reject every write, the current process stays quarantined but a cold-process
restart cannot be guaranteed safe; the UI requires retry before closing. Hung OS
storage calls, physical-device behavior, signed builds and provider behavior
remain separate validation prerequisites. No signing guard, API contract,
dependency, root submodule pin or release approval is changed.

Qualification: Node `.nvmrc` 20.19.4 and exact-lockfile `npm ci`; all 638 tests in
97 suites and `release:check` pass. Metro `/status` passes offline with an explicit
test-only loopback bind adapter and no device launch. The original source fails
the retained-account regression; cache-isolation tests retain their original
synchronous action contract. The unchanged macOS codesign/plist test fails on
both this candidate and protected baseline; this is not an iOS release pass.
See `docs/native-logout-qualification-2026-10-26.json` for scoped evidence.
