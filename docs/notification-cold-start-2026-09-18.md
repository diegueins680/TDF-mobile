# Notification first-launch follow-up

Android production build 11 (source `2244490`) crashes when a notification is the first route after clearing app data. The device reports `Maximum update depth exceeded` in Expo Router and an `APP_CRASH(EXCEPTION)` exit. The stricter Maestro flow reproduced this twice. The earlier iOS check launched the app before testing cold links and did not cover this state.

The candidate keeps the root navigator mounted while session and permission checks guard its screens, and keeps the legacy URL listener at the root. Notification and request links remain owned by Expo Router's native-intent handler. Existing server authorization and business-action confirmation flows are unchanged.

## Reproduction and verification

Use a dedicated test device: the flow clears app data. It submits no credentials and uses synthetic notification/request IDs.

```sh
maestro --device IOS_DEVICE_ID test e2e/notification-deep-links.yaml
maestro --device ANDROID_DEVICE_ID test -e APP_ID=com.tdf.records e2e/notification-deep-links.yaml
```

The flow opens a notification without a preliminary app launch, then a cold request link and a warm notification link. Router tests separately assert exact sign-in return destinations and withholding private content during session restoration.

## Evidence and current gate

- Candidate runtime `e002715`: all 82 suites / 481 tests and hosted CI passed. iOS simulator build `2a86362f-24b1-4546-b9ed-50ab59e35ca9` passed all three device-flow scenarios.
- Android candidate build `93bd011e-988c-4763-8941-fc6839b1b398`: direct OS launch reported `COLD`; the actual screen showed both sign-in fields and the app had no recorded exit. This verifies the first notification launch only.
- Complete Android automation remains **unverified**. The first candidate run timed out reading the hierarchy; a clean-device retry timed out starting the test driver. Actual screenshots showed unrelated Digital Wellbeing and system-process ANRs. Further isolated-emulator restarts failed the disk-space preflight amid shared-host resource contention. Do not count these as successful device runs.
- Release integration `454e925` retains the separately merged tab fixes from `667193e`, excluding unrelated provider/intake work. All 83 suites / 489 tests and the release asset/lint/typecheck/config checks passed. The integrated runtime still needs final device verification before publication.
- Google Play internal testing now selects only **TDF Registered Users Sep 2026 (68 people)**; saving and reloading confirmed persistence. Build 11 has not been published. Alpha 10 is unchanged.
- Apple build 19's separate review remains intact. Uploading a notification build or assigning an internal group does not establish external review approval or public availability.

Publication remains held until the complete Android flow and final integrated artifact are verified. Do not promote the failing build 11, claim that the unit tests reproduce its runtime loop, or bypass repository/store release gates.
