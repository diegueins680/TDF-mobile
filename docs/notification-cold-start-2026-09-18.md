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
- Earlier complete Android emulator automation was **unverified**. The first candidate run timed out reading the hierarchy; a clean-device retry timed out starting the test driver. Actual screenshots showed unrelated Digital Wellbeing and system-process ANRs. Further isolated-emulator restarts failed the disk-space preflight amid shared-host resource contention. Do not count these as successful device runs.
- Release integration `454e925` retains the separately merged tab fixes from `667193e`, excluding unrelated provider/intake work. All 83 suites / 489 tests and the release asset/lint/typecheck/config checks passed. The final integrated runtime passes the iOS and physical Android checks recorded below.
- Google Play internal testing now selects only **TDF Registered Users Sep 2026 (68 people)**; saving and reloading confirmed persistence. Build 11 has not been published. Alpha 10 is unchanged.
- Apple build 19's separate review remains intact. Uploading a notification build or assigning an internal group does not establish external review approval or public availability.

## Final integrated device results

Runtime source `4f7fcbde163cbc5ef2966a19fbafc557097f3936`:

- iOS simulator build `97f46ef1-804f-4d4e-bc29-ba56f2b16b14`: all three committed Maestro scenarios passed (exit 0), without submitting credentials.
- Physical Samsung SM-S928B, Android 16: all three scenarios passed using explicit-package Android VIEW intents and actual UI-hierarchy assertions for `usernameInput` and `passwordInput`. Both fresh notification and request launches reported `COLD`. The warm notification was delivered to the already-running top activity. No app crash or ANR was recorded; the only relevant stops were the test's explicit force stops.
- The physical device's existing Play-installed `com.tdf.records` version 4 uses a different signing certificate from the EAS preview. It was preserved without an update, uninstall, data clear, or credential access. Testing used a side-by-side `com.tdf.records.notificationqa` installation named **TDF Notification QA**.
- QA build `82a56bd5-afb2-4e5f-bde9-9795064c85cc`, APK SHA-256 `1280042bd9f9ab326e7066d6343e2c98ed8248aeba55aa0144fbe4c093806024`, verifies successfully with Android's `apksigner`. Local configuration-only commits `a494544` / `e8678af` change the app name, application ID, signing source, and isolated update channel. All application/navigation source is byte-identical to `4f7fcbd`. The QA variant is not a store release.
- The first physical automation attempt could not find Samsung's focus field in `dumpsys window windows`; switching the read-only probe to `dumpsys window displays` resolved that harness issue. The second complete run passed. Do not report the failed harness attempt as a pass.

Reproduction on the isolated package: clear only `com.tdf.records.notificationqa`, then dispatch `adb -d shell am start -W -a android.intent.action.VIEW -d <URL> com.tdf.records.notificationqa`. Use `tdf://notification/900000001`, force-stop the QA package before `tdf://access-requests/900000002`, and leave it running before `tdf://notifications/900000003`. Assert both sign-in fields after each dispatch. Never clear an existing personal TDF installation for this test.

These results qualify notification navigation and signed-out handoff, not Google OAuth, FCM delivery, Play app-signing compatibility, or store availability. Exact return destinations/session restoration are covered separately by router tests. No credentials or business actions were submitted. Final production artifacts must retain current reviewed authentication contracts and pass their own release gates; do not promote builds 11/12 or interfere with Alpha 10 and Apple 19 review.

Evidence is retained locally under `/private/tmp/tdf-notifications-phone-evidence/` (three screenshots and XML snapshots, OS dispatch records, `results.json`, process exit records) and `/tmp/tdf-notifications-integrated-ios-maestro/`. Do not claim that unit tests reproduce the old runtime loop or that a preview device pass establishes store availability.
