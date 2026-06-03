# iOS Build Runbook — Local Device Signing

**Owner:** tdf-label-release  
**Last updated:** 2026-06-02  
**Scope:** Unblock the first `iphoneos` Release build for `TDFRecords`.

## Current truth

- Prior first failing `xcodebuild` line: `Signing for "TDFRecords" requires a development team. Select a development team in the Signing & Capabilities editor.`
- Current project state on 2026-06-02: `tdf-mobile/ios/TDFRecords.xcodeproj/project.pbxproj` has **no** `DEVELOPMENT_TEAM` entry, so project signing is still unset.

## 1) Discover the Apple Team ID

Use either path:

1. **Xcode GUI:** Xcode → Settings → Accounts → select the Apple ID used for signing → copy the 10-character Team ID.
2. **Apple Developer web:** open the Apple Developer membership/account page and copy the Team ID shown for the active team.

## 2) Verify whether the project is still unset

Run from the repo root:

```bash
grep -n 'DEVELOPMENT_TEAM' tdf-mobile/ios/TDFRecords.xcodeproj/project.pbxproj || echo 'DEVELOPMENT_TEAM missing from project.pbxproj'
```

If the fallback message prints, the project still has no explicit team configured.

## 3) Pick one assignment path

### Option A — safest: select the Team in Xcode

1. Open `tdf-mobile/ios/TDFRecords.xcworkspace` in Xcode.
2. Select target **TDFRecords** → **Signing & Capabilities**.
3. Set **Team** to the Apple team you copied above.

### Option B — fastest: inject the Team ID for the build command

Run from the repo root, replacing `YOUR_TEAM_ID` with the real 10-character value:

```bash
cd tdf-mobile && xcodebuild -workspace ios/TDFRecords.xcworkspace -scheme TDFRecords -configuration Release -sdk iphoneos -derivedDataPath ios/build -allowProvisioningUpdates DEVELOPMENT_TEAM=YOUR_TEAM_ID
```

## 4) Verification

Success means the command above produces either a built app under `tdf-mobile/ios/build/Build/Products/Release-iphoneos/` or a **new** first error that is no longer about the missing development team.

## 5) After the `iphoneos` build succeeds — device-proof sequence

Once step 4 yields a built app (no signing error), run these proofs in this exact order. Stop and capture the first blocking error at whichever step fails.

1. **Install on a physical device:** deploy the Release build from `tdf-mobile/ios/build/Build/Products/Release-iphoneos/` to the connected iPhone (Xcode → Run on device, or `xcrun devicectl device install app`).
2. **Username/password login proof:** launch on-device, sign in with username/password, confirm an authenticated session. Capture pass/fail + first error line.
3. **Google login proof:** on the same device, complete the Google OAuth login path end-to-end, confirm an authenticated session. Capture pass/fail + first error line.
4. **On both proofs passing:** both required login paths are proven on-device — that is the gate to cut a new testing version (mission: "create a new testing version").

`GOOGLE_PLAY_SERVICE_ACCOUNT` stays queued and is not started until the iOS device-proof sequence above is green.

## Exact next operator action

**Diego:** reply with the Apple Team ID or select the Team in Xcode, then rerun:

```bash
cd tdf-mobile && xcodebuild -workspace ios/TDFRecords.xcworkspace -scheme TDFRecords -configuration Release -sdk iphoneos -derivedDataPath ios/build -allowProvisioningUpdates DEVELOPMENT_TEAM=YOUR_TEAM_ID
```
