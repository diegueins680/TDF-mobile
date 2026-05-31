# TDF Mobile iOS Build Runbook

## Simulator Release Build (Local)

### Standard Command

```bash
cd tdf-mobile/ios
xcodebuild -workspace TDFRecords.xcworkspace \
  -scheme TDFRecords \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath ../ios/build \
  ARCHS=x86_64 \
  build
```

### Why `ARCHS=x86_64`?

| Date | Incident | Root Cause | Fix |
|------|----------|------------|-----|
| 2026-05-30 | Release build killed by SIGKILL after ~12 min | Universal binary (x86_64 + arm64) exhausted host memory during linking | Force single-arch with `ARCHS=x86_64` |

- **Host:** Darwin 23.6.0, 16 GB RAM
- **Without `ARCHS=x86_64`:** Linker memory pressure → SIGKILL at ~70% build progress
- **With `ARCHS=x86_64`:** Build succeeds in ~9 min, binary size ~16 MB

### Output Artifact

- **Path:** `tdf-mobile/ios/build/Build/Products/Release-iphonesimulator/TDFRecords.app`
- **Binary:** Mach-O 64-bit executable x86_64
- **Use:** `xcrun simctl install booted <path>` or Detox `ios.sim.release`

### Known Blockers

| Blocker | Status | Escalated To | Notes |
|---------|--------|--------------|-------|
| `CORESIMULATOR_DEADLOCK` | ⚠️ MITIGATED | tdf-label-release | `simctl install` hangs on simulator `8DB9DCE0…`; **workaround**: use `525DA785…` (iPhone 16-Detox2) which validates post-reboot. See incident log below. |

#### `CORESIMULATOR_DEADLOCK` Incident Log

| Date (UTC) | Action | Result | Duration |
|------------|--------|--------|----------|
| 2026-05-30 14:42 | Fresh `ARCHS=x86_64` build | ✅ Build succeeded | ~9 min |
| 2026-05-30 16:52 | `simctl install` on booted sim (8DB9DCE0…) | ❌ Hang, killed at 45s | 45s |
| 2026-05-30 20:20 | Attempt host reboot via `osascript` | ⚠️ Reboot blocked — requires operator password / manual approval | — |
| 2026-05-30 20:21 | Kill `CoreSimulatorService` + `SimulatorTrampoline` daemons | ✅ Daemons restarted | — |
| 2026-05-30 20:22 | `simctl erase` primary sim | ✅ Erase succeeded | ~5s |
| 2026-05-30 20:23 | `simctl boot` erased sim | ✅ Boot succeeded | ~5s |
| 2026-05-30 20:23 | `simctl install` on freshly erased + booted sim | ❌ Hang, killed at 30s | 30s |
| 2026-05-30 20:24 | Attempt `simctl boot` alternate sim (D54D9253…) | ❌ Hang, killed at 30s | 30s |
| 2026-05-30 20:25 | Attempt `simctl list devices` | ❌ Hang, killed at 15s | 15s |
| 2026-05-30 20:26 | Kill orphaned `simctl list` process | ✅ Killed | — |
| 2026-05-30 20:26 | `simctl install` with CoreSimulatorService freshly restarted | ❌ Hang, killed at 30s | 30s |

**Conclusion (2026-05-30 23:03 UTC):** Host was rebooted. `simctl install` on `8DB9DCE0…` **still hangs** (killed at 60s). However, alternate simulator `525DA785…` (iPhone 16-Detox2) boots and installs successfully. App launches (PID 10269) and Detox regression **PASSes** (88.1s, both tests OK). The deadlock is **simulator-specific corruption** on `8DB9DCE0…`, not host-wide.

**Resolution:** `.detoxrc.js` permanently switched to `525DA785…`. Do not use `8DB9DCE0…` for release testing.

| Date (UTC) | Action | Result | Duration |
|------------|--------|--------|----------|
| 2026-05-30 23:03 | Host reboot | ✅ Uptime reset to 0 | — |
| 2026-05-30 23:04 | Boot `8DB9DCE0…` | ✅ Boot succeeded | ~5s |
| 2026-05-30 23:04 | `simctl install` on `8DB9DCE0…` | ❌ Hang, killed at 60s | 60s |
| 2026-05-30 23:05 | Boot `525DA785…` | ✅ Boot succeeded | ~5s |
| 2026-05-30 23:05 | `simctl install` on `525DA785…` | ✅ Install succeeded | ~30s |
| 2026-05-30 23:06 | `simctl launch` on `525DA785…` | ✅ Launch succeeded (PID 10269) | ~5s |
| 2026-05-30 23:07 | Detox regression `--reuse` on `525DA785…` | ✅ PASS (2/2 tests) | 88.1s |

## Physical Device Release Build (Local)

### Standard Command
```bash
cd tdf-mobile/ios
xcodebuild -workspace TDFRecords.xcworkspace \
  -scheme TDFRecords \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath ios/build \
  -allowProvisioningUpdates \
  build
```

### Prerequisites
- Apple Developer account enrolled ($99/year).
- Valid signing identity installed: `security find-identity -v -p codesigning` should show at least one identity.
- `DEVELOPMENT_TEAM` set in target build settings (Xcode → Signing & Capabilities → select Team).

### Known Blockers

| Blocker | Status | Escalated To | Notes |
|---------|--------|--------------|-------|
| `IOS_DEVELOPMENT_TEAM_MISSING` | ❌ ACTIVE | operator/CTO | `DEVELOPMENT_TEAM` absent from `project.pbxproj`; `security find-identity` returns 0 identities. See evidence `ios-development-team-missing-20260531-1020.md`. |

#### `IOS_DEVELOPMENT_TEAM_MISSING` Incident Log

| Date (UTC) | Action | Result | Duration |
|------------|--------|--------|----------|
| 2026-05-31 10:20 | `xcodebuild -sdk iphoneos -allowProvisioningUpdates` | ❌ Build failed — `Signing for "TDFRecords" requires a development team` | ~2 min |
| 2026-05-31 10:20 | `security find-identity -v -p codesigning` | ❌ 0 valid identities found | — |
| 2026-05-31 10:20 | Audit `project.pbxproj` for `DEVELOPMENT_TEAM` | ❌ Absent from target build settings (13B07F94/13B07F95) | — |

**Root cause:** Project created via Expo prebuild; never configured for manual signing. Physical-device builds require `DEVELOPMENT_TEAM` + signing identity + provisioning profile.

**Resolution options:**
1. **Xcode GUI** (requires Apple ID 2FA): Open `TDFRecords.xcworkspace` → select target → Signing & Capabilities → select Team.
2. **CLI injection** (requires operator-provided 10-character Team ID): Release Director injects `DEVELOPMENT_TEAM` into `project.pbxproj`.
3. **EAS cloud build** (recommended): `npx eas build --platform ios --profile preview` in interactive mode; EAS manages certificates automatically.

### Output Artifact
- **Path:** `tdf-mobile/ios/build/Build/Products/Release-iphoneos/TDFRecords.app`
- **Use:** Package into `.ipa` for physical device distribution, or install directly on connected device via Xcode.

---

### Next Actions

1. ✅ Detox regression re-enabled on `525DA785…`.
2. Monitor `8DB9DCE0…` for recovery after future macOS/Xcode updates; if still hung, erase or delete and recreate.
3. Evaluate `ONLY_ACTIVE_ARCH=YES` as alternative to `ARCHS=x86_64` if future Xcode changes break explicit arch flag.
4. **Resolve `IOS_DEVELOPMENT_TEAM_MISSING`:** Operator selects resolution path (Xcode GUI / CLI injection / EAS cloud build).

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-05-31 | tdf-label-release | Added `IOS_DEVELOPMENT_TEAM_MISSING` incident log and resolution options |
| 2026-05-31 | tdf-label-release | Added `CORESIMULATOR_DEADLOCK` full incident log with resolution |
| 2026-05-31 | tdf-label-release | Added `ARCHS=x86_64` memory-pressure mitigation with data |
| 2026-05-31 | tdf-label-release | Added physical-device build section and prerequisites |
