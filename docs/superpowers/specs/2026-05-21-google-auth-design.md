# Google OAuth Sign-Up — Donor Service Design

**Date:** 2026-05-21
**Scope:** `hopecard-donor-service` auth module only

---

## Overview

Add Google OAuth sign-up and login for the donor persona. Google credential
handling is fully delegated to APICenter via the `@implementsprint/sdk`
`gauth` wrappers. The donor service only handles profile upsert and JWT
issuance — it never holds Google client credentials.

---

## Architecture & Flow

```
Frontend                   Donor Service                   APICenter / gauth-gateway
   |                             |                                    |
   |-- GET /google/url --------> |                                    |
   |                             |-- gauthGetAuthorizationUrl() ----> |
   |                             |<-- { url } ----------------------- |
   |<-- { url } --------------- |                                    |
   |                             |                                    |
   |-- (browser → Google consent screen)                              |
   |                             |                                    |
   |<-- Google → GET /hopecard/donor/auth/google/callback?code=...    |
   |                   (backend)                                      |
   |                             |-- gauthExchangeCode({ code }) ---> |
   |                             |<-- { email, name, googleId } ----- |
   |                             |-- upsert digital_donor_profiles    |
   |                             |-- sign custom JWT                  |
   |-- 302 → /auth/google/success?token=<jwt> ----------------------- |
```

---

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/hopecard/donor/auth/google/url` | GET | Returns Google consent URL from APICenter |
| `/hopecard/donor/auth/google/callback` | GET | Exchanges code, upserts profile, issues JWT, redirects frontend |

Both endpoints are added to the existing `AuthController` and implemented as
new methods on `AuthService`.

---

## SDK Usage

No new env vars are required. The SDK is pre-configured by the CICD
infrastructure.

```ts
import { TribeClient } from '@implementsprint/sdk';

const client = new TribeClient({ /* resolved by CICD env */ });

// Step 1 — get consent URL
const { url } = await client.gauthGetAuthorizationUrl({
  redirectUri: callbackUrl,   // derived from request at runtime
  scopes: ['openid', 'email', 'profile'],
  accessType: 'offline',
});

// Step 2 — exchange code
const tokens = await client.gauthExchangeCode({
  code: req.query.code,
  redirectUri: callbackUrl,   // must match Step 1 exactly
});
// tokens includes: email, name (or given_name/family_name), googleId
```

The `redirectUri` is derived at runtime:

```ts
const callbackUrl = `${req.protocol}://${req.get('host')}/hopecard/donor/auth/google/callback`;
```

---

## Data & Profile Handling

### Supabase auth user

Use the service role admin client to create or find the Supabase auth user:

- If no Supabase user exists for the email: `admin.auth.admin.createUser({ email, email_confirm: true })` — no password set.
- If the user already exists: look up by email and use their existing `id`.

### `digital_donor_profiles` upsert — three cases

| Case | Action |
|---|---|
| No profile for this email | Insert with `status=pending`, `role=buyer`, `first_name`/`last_name` from Google profile, location fields null |
| Profile exists, `auth_user_id` not linked | Update to set `auth_user_id` |
| Profile exists and already linked | Login path — check `status` before issuing JWT |

### JWT

Identical shape to existing login JWT, signed with `JWT_SECRET`:

```ts
{ sub: userId, email, persona: 'donor', system: 'hopecard' }
// expiry: 24h, alg: HS256
```

### Success redirect

```
302 → ${NEXT_PUBLIC_APP_URL}/auth/google/success?token=<jwt>
```

---

## Error Handling

Callback errors redirect the frontend rather than returning JSON (since the
browser is following a redirect, not making an API call):

```
302 → ${NEXT_PUBLIC_APP_URL}/auth/google/error?reason=<slug>
```

| Scenario | Reason slug |
|---|---|
| `gauthExchangeCode` fails | `code_exchange_failed` |
| Google profile has no email | `no_email` |
| Supabase user creation fails | `account_creation_failed` |
| Profile upsert fails | `profile_creation_failed` |
| Profile status is `pending` | `pending_approval` |
| Profile status is `rejected` | `rejected` |

The `GET /google/url` endpoint returns standard HTTP 4xx/5xx JSON errors —
the frontend is making a normal API fetch there, not following a redirect.

---

## Testing

Unit tests added to the existing `auth.service.spec.ts` and
`auth.controller.spec.ts` in `hopecard-donor-service`. The SDK `TribeClient`
and Supabase admin client are mocked.

### Service test cases

- `googleGetAuthUrl` — returns URL from SDK; throws on SDK failure
- `googleCallback` — new profile: inserts, issues JWT, returns success redirect
- `googleCallback` — existing unlinked profile: updates `auth_user_id`, issues JWT
- `googleCallback` — existing approved profile: issues JWT (login path)
- `googleCallback` — existing pending profile: returns `pending_approval` error redirect
- `googleCallback` — code exchange fails: returns `code_exchange_failed` error redirect
- `googleCallback` — Google profile has no email: returns `no_email` error redirect

### Controller test cases

- `GET /google/url` calls service and returns `{ url }`
- `GET /google/callback` calls service and issues 302 redirect

---

## Files Changed

- `apps/hopecard-donor-service/src/auth/auth.controller.ts` — two new route handlers
- `apps/hopecard-donor-service/src/auth/auth.service.ts` — two new service methods
- `apps/hopecard-donor-service/src/auth/auth.service.spec.ts` — new test cases
- `apps/hopecard-donor-service/src/auth/auth.controller.spec.ts` — new test cases

No new modules, no new env vars, no schema changes.
