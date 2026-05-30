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

### Next Actions

1. ✅ Detox regression re-enabled on `525DA785…`.
2. Monitor `8DB9DCE0…` for recovery after future macOS/Xcode updates; if still hung, erase or delete and recreate.
3. Evaluate `ONLY_ACTIVE_ARCH=YES` as alternative to `ARCHS=x86_64` if future Xcode changes break explicit arch flag.
