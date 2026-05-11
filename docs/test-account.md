# Test Account Reference

> **Owner:** tdf-label-release  
> **Updated:** 2026-05-11 02:20 UTC  
> **Scope:** Permanent test account for release verification and simulator smoke tests.

---

## Current Test Account

| Field | Value |
|-------|-------|
| **Username** | `tdf-owner` |
| **Password** | `TDFowner2025!` |
| **Backend** | `http://127.0.0.1:8080` (local dev) |
| **Party ID** | `33` (current deployment) |
| **Required Roles** | `Fan`, `Customer`, `Manager` |

### Why `Manager` is required

The mobile app hits `GET /parties` immediately after login. That endpoint requires `ModuleCRM` access. Without the `Manager` role:

- Login succeeds (200 + token)
- `GET /parties` returns **403** `Missing access to module: CRM`
- App shows error banner: "Request failed with status code 403"

With `Manager` role:

- `modulesForRoles` includes `ModuleCRM`
- `GET /parties` returns 200 with party list
- App navigates to main screen correctly

---

## Reproducible Setup (SQL)

Run against the Postgres container used by `tdf-hq-app-1`:

```bash
# 1. Create the party record (if not exists)
docker exec tdf-hq-pg psql -h host.docker.internal -U postgres -d tdf_hq -c "
INSERT INTO party (display_name, legal_name, is_company, created_at)
VALUES ('TDF Owner', 'TDF Owner', false, NOW())
ON CONFLICT DO NOTHING
RETURNING id;
"

# 2. Note the party_id (e.g. 33), then add roles
docker exec tdf-hq-pg psql -h host.docker.internal -U postgres -d tdf_hq -c "
INSERT INTO party_role (party_id, role, active) VALUES
(33, 'Fan', true),
(33, 'Customer', true),
(33, 'Manager', true)
ON CONFLICT DO NOTHING;
"

# 3. Create the login credential (password is bcrypt-hashed by the app)
#    This step is easiest done via the Haskell seed function or API.
#    If seeding is disabled, use the running backend to register.
```

### One-liner role fix (existing account)

If the account exists but lacks `Manager`:

```bash
docker exec tdf-hq-pg psql -h host.docker.internal -U postgres -d tdf_hq -c \
"INSERT INTO party_role (party_id, role, active) VALUES (33, 'Manager', true) ON CONFLICT DO NOTHING;"
```

---

## Reproducible Setup (Haskell Seed — preferred for fresh environments)

The `TDF.Seed` module creates staff accounts when `ALLOW_SEEDED_CREDENTIALS=true`:

```haskell
ensureStaff now "TDF Owner" Nothing Manager "owner-token" "tdf-owner" "TDFowner2025!"
```

To make this permanent, add a line to the `staffAccounts` list in `src/TDF/Seed.hs`:

```haskell
, ("TDF Owner", Nothing, Manager, "owner-token", "tdf-owner", "TDFowner2025!")
```

Then restart the backend with seeding enabled:

```bash
ALLOW_SEEDED_CREDENTIALS=true docker compose up -d tdf-hq-app-1
```

> **Note:** The existing `staffAccounts` list only seeds `Admin`, `Manager`, `Reception`, `Accounting`, `Engineer`, and `Customer` demo accounts. It does **not** currently include `tdf-owner`. Extending the seed is the cleanest long-term fix.

---

## Dev Auto-Fill (`__DEV__`)

### Current state

`app/auth.tsx` contains a `__DEV__`-only `useEffect` that auto-fills:

- Username: `tdf-owner`
- Password: `TDFowner2025!`

This was added to bypass `SIMULATOR_TEXT_INPUT_BLOCKED` (AppleScript/System Events cannot inject keystrokes into React Native `TextInput` in iOS Simulator).

### Retirement plan

| Step | Owner | Condition |
|------|-------|-----------|
| 1. Platform configures Detox or idb-companion | tdf-label-platform | Real text-input automation works in simulator |
| 2. Release Director runs end-to-end auth proof with Detox | tdf-label-release | Both username/password and Google OAuth pass |
| 3. Remove `__DEV__` auto-fill `useEffect` from `app/auth.tsx` | tdf-label-release | PR with Detox tests replacing the workaround |
| 4. Document Detox test command in this file | tdf-label-release | Same PR |

**Do NOT remove the auto-fill before Step 2 is complete.** It is the only known working path for automated simulator login verification.

---

## Verification Checklist

Before declaring a build shippable, confirm:

- [ ] `tdf-owner` account exists in the target backend
- [ ] Account has roles `Fan`, `Customer`, `Manager`
- [ ] `POST /login` with `tdf-owner` / `TDFowner2025!` returns 200 + token
- [ ] `GET /parties` with that token returns 200 (not 403)
- [ ] Dev auto-fill (if present) only runs under `__DEV__`

---

## Related Blockers

| Blocker | Status | Owner | Notes |
|---------|--------|-------|-------|
| `SIMULATOR_TEXT_INPUT_BLOCKED` | Workaround active | tdf-label-platform | `__DEV__` auto-fill masks this for dev builds |
| `SIMULATOR_SYSTEM_DIALOG_BLOCKED` | Open | tdf-label-platform | ASWebAuthenticationSession dialog resists AppleScript |
| Detox / idb-companion install | Blocked on `XCODE_CLT_OUTDATED` + `NPM_CACHE_ROOT_OWNED` | operator + tdf-label-platform | Fix tracked in Platform reports |
