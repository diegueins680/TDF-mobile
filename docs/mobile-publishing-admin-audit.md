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

Still expected to remain blocked unless a human provides relay tabs:

- `Live console audit status: BLOCKED until relay-attached tabs are provided`

Interpretation:

- `EAS auth/project visibility: OK` means the machine can read the logged-in Expo identity/project metadata.
- Browser storage signals only show that local Chrome/Brave profiles appear to hold relevant session databases. The script does **not** inspect secret contents.
- Live console audit being blocked is normal until someone attaches signed-in App Store Connect and Google Play Console tabs through the browser relay.

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
