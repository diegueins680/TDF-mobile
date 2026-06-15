# Google Play Service Account Runbook

> Owner: tdf-label-release / human operator  
> Last updated: 2026-05-29 07:20 UTC  
> Blocker: `GOOGLE_PLAY_SERVICE_ACCOUNT` — last active store-publish blocker

## Goal
Create a Google Play Console service account, download its JSON key, and add it to EAS secrets so Android builds can be submitted automatically.

## Prerequisites
- Google Play Console account with admin access
- Billing profile set up in Play Console (required for API access)
- EAS CLI installed locally (`npm install -g eas-cli`)
- Expo account logged in (`npx eas login`)

---

## Step 1 — Open Play Console API Access
**Owner:** Operator  
**Verification:** Screenshot of API access page

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app (`com.tdf.records`)
3. Navigate to **Settings → Developer account → API access**
4. If you see "Create a service account" button, proceed to Step 2
5. If you see a billing verification banner, complete billing verification first — this is a **hard blocker**. Document the verification status and escalate to tdf-label-ceo.

## Step 2 — Create Service Account in Google Cloud
**Owner:** Operator  
**Verification:** Service account email visible in Cloud Console IAM list

1. Click **Create a service account** (or **Create new service account**)
2. This opens Google Cloud Console in a new tab
3. In Cloud Console:
   - **Service account name:** `tdf-label-release`
   - **Service account ID:** `tdf-label-release` (auto-generated)
   - **Description:** `EAS automated Android release submission for TDF Records`
4. Click **Create and continue**
5. **Grant this service account access to project:**
   - Role: **Service Account User** (`roles/iam.serviceAccountUser`)
   - Click **Add another role**
   - Role: **Release Manager** (or `roles/androidpublisher` if available)
6. Click **Continue** → **Done**

## Step 3 — Grant Play Console Access to the Service Account
**Owner:** Operator  
**Verification:** Service account appears in Play Console → API access → Service accounts list

1. Return to Play Console tab (API access page)
2. Refresh the page
3. The new service account (`tdf-label-release@<project-id>.iam.gserviceaccount.com`) should appear
4. Click **Grant access**
5. Set **Account permissions:**
   - **Release:** Release to production, exclude devices, use Play App Signing, view app information
   - Minimum viable: **Release to production** + **View app information**
6. Click **Invite user** (or **Apply**)

## Step 4 — Create and Download JSON Key
**Owner:** Operator  
**Verification:** `ls -la tdf-mobile/secrets/tdf-label-release-*.json` returns one file

1. In Google Cloud Console, go to **IAM & Admin → Service accounts**
2. Find `tdf-label-release`
3. Click the three-dot menu → **Manage keys**
4. Click **Add key → Create new key**
5. Select **JSON** format
6. Click **Create** — the key downloads automatically
7. **Move the downloaded file to the repo:**
   ```bash
   mv ~/Downloads/tdf-label-release-*.json /Users/diegosaa/GitHub/tdf-app/tdf-mobile/secrets/
   ```
8. **Do NOT commit this file.** It is already in `.gitignore` (verify: `grep secrets/ tdf-mobile/.gitignore`)

## Step 5 — Add JSON Key to EAS Secrets
**Owner:** Operator  
**Verification:** `npx eas secret:list` shows `GOOGLE_SERVICE_ACCOUNT_KEY`

1. From `tdf-mobile/` directory:
   ```bash
   cd /Users/diegosaa/GitHub/tdf-app/tdf-mobile
   npx eas secret:create --name GOOGLE_SERVICE_ACCOUNT_KEY --value-file secrets/tdf-label-release-*.json --scope project
   ```
2. Confirm the secret was created:
   ```bash
   npx eas secret:list
   ```
3. You should see:
   - Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
   - Type: `file`
   - Scope: `project`

## Step 6 — Verify EAS Build Can Submit
**Owner:** Operator  
**Verification:** EAS build output shows "Using Google Service Account" without errors

1. Trigger a non-interactive Android build:
   ```bash
   npx eas build --profile preview --platform android --non-interactive
   ```
2. In the build logs, look for:
   - `Using Google Service Account for submission`
   - No `GOOGLE_PLAY_SERVICE_ACCOUNT` errors
3. The build will queue remotely. You do not need to wait for it to complete in this step.

## Step 7 — Update Blocker Status
**Owner:** tdf-label-release  
**Verification:** Blocker table updated in `reports/tdf-label-release.md`

Once Step 5 is confirmed:
1. Update the blocker status table:
   ```
   | GOOGLE_PLAY_SERVICE_ACCOUNT | ✅ RESOLVED <date> | EAS secret created; build submit enabled | tdf-label-release |
   ```
2. Append evidence to your next report.

---

## Rollback Plan

If the service account key is compromised:
1. Delete the key in Google Cloud Console (IAM → Service accounts → tdf-label-release → Keys → Delete)
2. Create a new key (Step 4)
3. Update the EAS secret:
   ```bash
   npx eas secret:delete GOOGLE_SERVICE_ACCOUNT_KEY
   npx eas secret:create --name GOOGLE_SERVICE_ACCOUNT_KEY --value-file secrets/<new-key>.json --scope project
   ```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "API access is not enabled" in Play Console | Billing not verified | Complete billing verification or escalate to tdf-label-ceo |
| "Permission denied" during EAS submit | Service account lacks Release Manager role | Revisit Step 3, ensure Release to production is granted |
| `eas secret:create` fails with "already exists" | Secret was created previously | Run `npx eas secret:delete GOOGLE_SERVICE_ACCOUNT_KEY` first, then re-create |
| JSON key file not found | Downloaded to wrong location | Check `~/Downloads/` and move to `tdf-mobile/secrets/` |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-05-29 | tdf-label-cto | Initial draft (Steps 1–7) |
