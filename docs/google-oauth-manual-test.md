# Google OAuth Manual Device Test Plan

> Created: 2026-05-11 13:18 UTC  
> Owner: tdf-label-release  
> Scope: End-to-end Google login on a physical iOS device or simulator, since automated e2e is blocked by `DETOX_LAUNCHAPP_TIMEOUT`.

## Prerequisites

1. Backend running with `GOOGLE_CLIENT_ID=1016946267087-mvr22vuc8dql37fem7aa1msdnatjvhh4.apps.googleusercontent.com` (confirmed fixed 2026-05-10 22:31 UTC).
2. Mobile app built with `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `GOOGLE_IOS_URL_SCHEME` set (confirmed in `tdf-mobile/.env.local`).
3. Test device/simulator has a Google account signed in via Settings → Mail → Accounts → Google, OR Safari is signed into google.com.
4. Device can reach `http://<backend-host>:8080` (use ngrok or LAN IP if not localhost).

## Test Steps

### Step 1 — Fresh install
- Delete any existing `TDFRecords` app from device/simulator.
- Install fresh `.app` or TestFlight build.
- Launch app; expect onboarding screen with "Comenzar" button.

### Step 2 — Navigate to login
- Tap "Comenzar" → navigates to login screen.
- **Expected**: "Inicia sesión" header, username/password fields, "Entrar con password" button, "Continuar con Google" button.
- **Pass criteria**: All UI elements visible and tappable.

### Step 3 — Tap "Continuar con Google"
- Tap the Google button.
- **Expected**: System dialog "TDFRecords Wants to Use google.com to Sign In" appears with [Cancel] [Continue].
- **Pass criteria**: Dialog appears (proves `ASWebAuthenticationSession` is configured).

### Step 4 — Dismiss system dialog and proceed
- Tap [Continue] on system dialog.
- **Expected**: SafariViewController or Google account picker opens, showing signed-in Google accounts.
- **Pass criteria**: Google account picker or consent screen loads without error.

### Step 5 — Select account and authorize
- Select a test Google account.
- If consent screen appears, review scopes and tap "Allow".
- **Expected**: App returns to TDFRecords with session active.
- **Pass criteria**:
  - Login screen dismissed.
  - Main screen (clients/parties list) loads.
  - No "Request failed with status code" error banner.
  - Session status shows "Sesión: Activa".

### Step 6 — Verify backend session
- (Optional) Check backend logs: `docker logs tdf-hq-app-1 | grep "/login/google"`.
- **Expected**: `POST /login/google` returns 200 with JSON containing `token`, `partyId`, and `roles`.
- **Pass criteria**: HTTP 200, response body contains valid JWT token.

### Step 7 — Logout and re-login
- Tap "Cerrar sesión" in app.
- Repeat Step 3–5.
- **Expected**: Second login should be faster (Google remembers consent).
- **Pass criteria**: Same as Step 5.

## Fail Criteria (any one = BLOCKER)

| # | Failure | Likely Cause | Owner |
|---|---------|--------------|-------|
| 1 | System dialog does NOT appear | Missing `GOOGLE_IOS_URL_SCHEME` or `CFBundleURLTypes` | tdf-label-platform |
| 2 | Safari opens but shows "Error 400: redirect_uri_mismatch" | `GOOGLE_IOS_URL_SCHEME` or client ID mismatch in Google Console | tdf-label-platform |
| 3 | App returns to login screen with "Google Sign-In is not configured" | Backend missing `GOOGLE_CLIENT_ID` | tdf-label-platform |
| 4 | App returns to login screen with "Authentication failed" | Backend rejects token audience | tdf-label-platform |
| 5 | Main screen loads but 403 error banner | Test user missing `Manager` role | tdf-label-release |
| 6 | Main screen loads but blank/no parties | Network unreachable or `GET /parties` failing | tdf-label-platform |

## Known Blockers

- `DETOX_LAUNCHAPP_TIMEOUT` — automated e2e blocked; this manual plan is the fallback.
- `SIMULATOR_SYSTEM_DIALOG_BLOCKED` — AppleScript cannot tap [Continue] on ASWebAuthenticationSession dialog; manual test required.

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Tester | | | PASS / FAIL |
| Release Director | tdf-label-release | | Reviewed |

## Related Artifacts

- `tdf-mobile/docs/release-readiness.md` — go/no-go table
- `tdf-mobile/docs/test-account.md` — test account setup
- `tdf-mobile/.env.local` — OAuth credentials
