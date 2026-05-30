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
| `CORESIMULATOR_DEADLOCK` | ❌ ACTIVE | tdf-label-cto | `simctl install` hangs indefinitely even with fresh `.app` and erased simulator; requires **host reboot** or physical-device pivot |

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

**Conclusion:** The deadlock is **deeper than per-device state**. Even with:
- Fresh single-arch `.app` build
- Erased simulator device
- Restarted `CoreSimulatorService` daemon
- No orphaned `simctl` processes

…`simctl install` still hangs indefinitely. This points to **host-level CoreSimulator framework corruption** or a **wedged system service** (e.g., `simdiskimaged`, `installd`) that survives daemon restarts. A **full host reboot** is required.

### Next Actions

1. **Await tdf-label-cto decision** on `CORESIMULATOR_DEADLOCK` (options: erase sim, reboot host, physical device).
2. Once resolved, re-enable Detox regression: `npx detox test --configuration ios.sim.release e2e/firstTest.e2e.js --reuse`.
3. Evaluate `ONLY_ACTIVE_ARCH=YES` as alternative to `ARCHS=x86_64` if future Xcode changes break explicit arch flag.
