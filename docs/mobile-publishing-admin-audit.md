# Mobile publishing admin audit

Use `scripts/mobile-publishing-admin-audit.sh` when release/admin staff need a quick local snapshot of TDF mobile publication readiness without digging through Expo, Apple, Play Console, or host-tooling state by hand.

## Run it

From the repo root (`/Users/diegosaa/GitHub/tdf-app`):

```bash
bash scripts/mobile-publishing-admin-audit.sh tdf-mobile/docs/evidence/mobile-publishing-admin-audit-latest.md
```

What this does:

- runs the audit against the current workspace and `tdf-mobile`
- writes a markdown report to the path you pass as the first argument
- creates the destination directory automatically if it does not exist
- also prints the same report to stdout

If you omit the argument, the script still runs, but the report is only printed to stdout and not saved in the repo.

## What the report answers quickly

The generated report is meant to answer these operator questions fast:

- Are the support/privacy/terms/data-deletion pages reachable and returning `200`?
- Is local EAS auth/project visibility available?
- Is there any browser-session signal suggesting Chrome/Brave has stored console sessions locally?
- Are local Apple signing materials or App Store Connect API key files present?
- Are Android keystore / Play JSON filenames present in the workspace?
- Does this Mac have the main local publishing tools installed?

## How to read healthy vs risky output

### Endpoint validation

Healthy:

- each endpoint row shows `200`
- the title looks correct
- verdict is `OK`

Risky / blocked:

- any non-`200` status
- `BLOCKED` verdict
- missing expected support/privacy/deletion copy

Interpretation: this section is about public store-policy surface area. A blocked endpoint is a real release/admin problem because App Store / Play metadata often links here.

### Release / admin visibility

Healthy enough:

- `EAS auth/project visibility: OK`
- browser session storage signals are non-zero
- `Chrome relay raw probe (http://127.0.0.1:18792/json/version): RESPONSIVE` or `UNAUTHORIZED`

Still expected to remain blocked unless a human provides relay tabs:

- `Live console audit status: BLOCKED until relay-attached tabs are provided`

Interpretation:

- `EAS auth/project visibility: OK` means the machine can read the logged-in Expo identity/project metadata.
- Browser storage signals only show that local Chrome/Brave profiles appear to hold relevant session databases. The script does **not** inspect secret contents.
- The Chrome relay raw probe isolates whether the local relay endpoint at `127.0.0.1:18792` answers at all before anyone blames App Store Connect or Google Play access.
- Live console audit being blocked is normal until someone attaches signed-in App Store Connect and Google Play Console tabs through the browser relay.

`Chrome relay raw probe` quick triage:

- `RESPONSIVE` means the local relay endpoint answered with JSON. This is healthy transport evidence only; it still does **not** prove attached auth or live store-console access.
- `UNAUTHORIZED` means the port is reachable, but a bare raw HTTP probe is rejected. Treat this as `relay reachable but unauthenticated from this probe`, not as proof that the relay is down.
- `UNREACHABLE` or `NO_RESPONSE` means the local relay lane itself is not answering and should be treated as a real operator blocker before store-console work.
- `Chrome relay raw probe detail` is there so release can carry forward the exact blocker quote instead of generic “browser control broken” language.

`EAS whoami` quick triage:

- A successful `EAS whoami` result proves this Mac has an active local Expo session and can identify the currently logged-in Expo account.
- Treat it as healthy only when the reported account is the expected Expo operator/account for TDF mobile.
- Do **not** treat it as proof that the operator can access App Store Connect, Google Play Console, or any store submission credential path.
- Submission readiness still depends on project linkage, store-side permissions, and/or relay-backed console verification.

### Credentials / signing prerequisites

Healthy:

- Apple code-signing identity count is greater than `0` when local Apple submission/signing is expected
- provisioning profiles are present when a local iOS path is expected
- App Store Connect API key files exist in approved standard locations when using that path
- Android keystore / Play JSON filenames are present when Android local submission depends on them

Risky / blocked:

- any required count is `0`
- the report says no local material was found

Interpretation:

- This section measures whether a **local/manual** publishing path is prepared.
- If the team is intentionally using **EAS-managed credentials only**, missing local Apple materials may be informational rather than an immediate release blocker.
- If a human expects to submit from this Mac, zero counts here are real blockers.

Apple codesigning summary quick triage:

- `0 valid identities found` means this Mac cannot currently do **local Apple signing** with installed certificates.
- Treat that as **informational** when the planned path is an EAS-managed cloud build and nobody expects to archive/sign locally in Xcode on this machine.
- Treat it as a **real blocker** when the planned path requires local signing, local archive export, or any operator workflow that assumes certificates are already installed on this Mac.
- Keep this separate from App Store Connect auth: local signing identities, provisioning profiles, and ASC API key files solve different parts of the release path.

### Release metadata / Android submit defaults

Healthy / expected when using the current EAS submit profile as a safe handoff target:

- `submit.production.android.track: internal`
- `submit.production.android.releaseStatus: draft`

Risky only if the operator expected a public rollout immediately after submit:

- the audit shows `internal` + `draft`, but the handoff assumes closed/open/production rollout already exists

Interpretation:

- These values come from repo configuration (`eas.json`) and describe where a future `eas submit --profile production --platform android` is intended to land.
- `internal` means the Android submission target is the Play internal testing track, not open testing or production.
- `draft` means the submitted release is intended to stay as a draft for human review/promotion, not auto-roll out.
- This is **configuration evidence**, not proof that any Android build has already been submitted to Play Console.
- To confirm a real submission exists, operators still need EAS submission output or a relay-backed Play Console check.

### Build / submit scripts and EAS profile wiring

Healthy / expected:

- `package.json` includes the expected `build:*` / `submit:*` scripts for the intended Android and iOS handoff paths
- `eas.json` contains matching `build` and `submit` profile entries for those commands

Risky only if the operator handoff assumes a script/profile exists but the audit evidence shows it is missing or pointed at the wrong platform/profile:

- a needed `build:*` or `submit:*` script is absent
- the referenced EAS profile is missing or clearly wired for a different target than the planned release step

Interpretation:

- These lines show that the repo exposes named release commands and default EAS workflow wiring for future builds/submissions.
- Treat them as **workflow-availability evidence**, not proof that local/store credentials are configured, cloud credentials are valid, or a build/submission has already run.
- A present `build:ios:production`, `build:android:production`, or `submit:*` script only means operators have a documented command path to invoke.
- Real execution evidence still has to come from the command output, EAS build/submit records, or relay-backed App Store Connect / Play Console checks.

### Expo project linkage in app config

Healthy / expected:

- the audit evidence shows an Expo `owner`
- `updates.url` points at the expected Expo Updates project
- the EAS project ID in app config matches the expected TDF mobile project

Risky only if the values are missing or clearly point at the wrong Expo account/project:

- `owner` is absent or unexpected
- `updates.url` / project ID do not match the intended Expo project for TDF mobile

Interpretation:

- These values show that the app config is wired to a specific Expo account/project for EAS Updates and related Expo services.
- Treat them as **project-linkage evidence**, not proof that an iOS or Android store listing exists, that a binary has been submitted, or that store review metadata is complete.
- A correct `owner`, `updates.url`, and EAS project ID help confirm the repo is pointing at the intended Expo backend, which is useful for operator sanity checks and handoff validation.
- Store publication state still requires separate evidence from EAS build/submit output or relay-backed App Store Connect / Play Console inspection.

### Host / operator toolchain

Healthy:

- the required row shows `OK`
- evidence points to an installed tool/version

Risky / blocked:

- `Java runtime`, `Fastlane`, `sdkmanager`, `Transporter.app`, or another required tool shows `BLOCKED`

Interpretation:

- Missing tooling only blocks the workflows that rely on it.
- Example: no `fastlane` is irrelevant if the team is not using fastlane locally; missing `sdkmanager` matters if Android local build/submission or SDK management is expected on this Mac.

### Operator-facing gaps CIO / Release should know

This is the fastest skim section. Treat it as the script's plain-language summary of what still needs human follow-up.

- If the list is short and expected, the machine is close to ready.
- If the list includes public endpoint failures, missing credentials, or missing local tooling for the chosen release path, escalate before the next release attempt.

## Assumptions and limits

- The script is a local operator audit, not a full store-console audit.
- It needs network access to check public support/policy pages.
- It can confirm local EAS visibility, but live App Store Connect / Play Console verification still requires relay-attached signed-in tabs.
- It reports filenames/locations for local credential material, not secret contents.
- It is best used as a preflight snapshot before release or handoff.
