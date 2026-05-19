# Persona JWT Guard — Design Spec

**Date:** 2026-05-19  
**Branch:** feat/hopecard-integration  
**Goal:** Prevent a logged-in user from accessing another persona's dashboard or backend endpoints by enforcing `persona` and `system` JWT claims end-to-end.

---

## Problem

A user who holds a valid JWT for persona X can currently:
- Call any backend endpoint on any persona service (guard only checks signature, never claims)
- Type a URL for a different persona's frontend dashboard and the page renders

Both gaps exist because:
1. Only the admin service issues JWTs with `persona`/`system` claims — donor, beneficiary, and CM do not
2. The common `JwtGuard` verifies the signature but never reads `persona`/`system`
3. No frontend middleware exists to block cross-persona URL navigation

---

## Scope

Three independent changes, delivered together:

1. **JWT Issuance** — all four persona services issue `{ persona, system }` claims on login
2. **Backend Guard** — common `JwtGuard` enforces persona+system match, returns 403 on mismatch
3. **Frontend Middleware** — Next.js `middleware.ts` redirects cross-persona URL access before page renders

---

## Section 1 — JWT Issuance

### Admin (`apps/hopecard-admin-service`)
No change. Already issues `{ persona: 'admin', system: 'hopecard' }` in `auth.service.ts:verifyOTP()`.

### Donor (`apps/hopecard-donor-service`)
`auth.service.ts:login()` currently returns the raw Supabase session (`data.session`). After credential + `digital_donor_profiles` validation:
- Add `SignJWT` call using `jose`
- Payload: `{ sub: userId, email, persona: 'donor', system: 'hopecard' }`
- Expiry: 24 h
- Return `{ success: true, token, user }` — drop raw session from response

### Beneficiary (`apps/hopecard-beneficiary-service`)
No login endpoint exists. Add:
- `POST /auth/login` in `auth.controller.ts`
- `login(email, password): Promise<{ token: string }>` in `auth.service.ts`
- Flow: `supabase.auth.signInWithPassword` → confirm row in `beneficiary_profiles` → issue JWT `{ persona: 'beneficiary', system: 'hopecard' }`

### Campaign Manager (`apps/hopecard-campaign-manager-service`)
Same gap as beneficiary. Add:
- `POST /auth/login` in `auth.controller.ts`
- `login(email, password): Promise<{ token: string }>` in `auth.service.ts`
- Flow: `supabase.auth.signInWithPassword` → confirm row in `campaign_manager_profiles` → issue JWT `{ persona: 'cm', system: 'hopecard' }`

**Shared config:**
- All services use the `JWT_SECRET` env var (already present)
- All use `jose` `SignJWT` with `HS256` (matching admin pattern)
- Token lifetime: 24 h

---

## Section 2 — Backend Guard

### `libs/common/src/guards/jwt.guard.ts`
Extend `JwtGuard` to accept `expectedPersona: string` in its constructor.

After `jwtVerify` succeeds, add claim check:
```
if (payload.persona !== expectedPersona || payload.system !== 'hopecard') {
  throw new ForbiddenException({ message: 'Persona mismatch', code: 'PERSONA_MISMATCH' })
}
```

The no-arg constructor path keeps existing `@Protected()` usage working (signature-only check, no persona enforcement).

### New decorator: `libs/common/src/decorators/require-persona.decorator.ts`
```ts
export const RequirePersona = (persona: string) => UseGuards(new JwtGuard(persona));
```

### Application
Apply `@RequirePersona('<persona>')` at the controller class level on every non-auth controller in each service:

| Service | Persona value | Controllers to guard |
|---|---|---|
| hopecard-admin-service | `'admin'` | all except `AuthController` |
| hopecard-donor-service | `'donor'` | all except `AuthController` |
| hopecard-beneficiary-service | `'beneficiary'` | all except `AuthController` |
| hopecard-campaign-manager-service | `'cm'` | all except `AuthController` |

`AuthController` routes (`/auth/login`, `/auth/verify-otp`, etc.) remain unguarded — they are the entry point.

**Error contract:**
- Missing/invalid JWT → 401 `MISSING_AUTH_TOKEN` / `INVALID_JWT` (unchanged)
- Valid JWT, wrong persona → 403 `PERSONA_MISMATCH`

---

## Section 3 — Frontend Middleware

**File:** `hope-card/middleware.ts` (Next.js root, above `src/`)

**Matcher:** `/hope-card/:persona/:path*` — covers all four persona dashboard trees.

**Token source:** Cookie named `hopecard_token` (set by each persona's login page after receiving the JWT from the backend).

**Persona map:**
```
/hope-card/admin       → 'admin'
/hope-card/donor       → 'donor'
/hope-card/beneficiary → 'beneficiary'
/hope-card/cm          → 'cm'
```

**Logic:**
1. Extract URL prefix → look up expected persona
2. Read `hopecard_token` cookie
3. No token → redirect to `/hope-card/<prefix>/login`
4. Decode JWT payload (base64 decode of middle segment, no signature check — backend is the trust boundary)
5. `payload.persona !== expectedPersona` → redirect to `/hope-card/<payload.persona>/dashboard`
6. Match → allow request through

**What middleware does NOT do:** verify JWT signature. Signature verification happens on every backend API call. The middleware's only job is preventing the wrong page from rendering.

---

## Non-goals

- Refresh token flow — out of scope
- Role-based access within a persona (e.g. admin sub-roles) — out of scope
- Signature verification in frontend middleware — intentionally excluded

---

## File Change Summary

| File | Change |
|---|---|
| `apps/hopecard-donor-service/src/auth/auth.service.ts` | Issue custom JWT in `login()` |
| `apps/hopecard-beneficiary-service/src/auth/auth.service.ts` | Add `login()` method |
| `apps/hopecard-beneficiary-service/src/auth/auth.controller.ts` | Add `POST /auth/login` |
| `apps/hopecard-campaign-manager-service/src/auth/auth.service.ts` | Add `login()` method |
| `apps/hopecard-campaign-manager-service/src/auth/auth.controller.ts` | Add `POST /auth/login` |
| `libs/common/src/guards/jwt.guard.ts` | Accept `expectedPersona`, add claim check |
| `libs/common/src/decorators/require-persona.decorator.ts` | New `@RequirePersona` decorator |
| `libs/common/src/index.ts` | Export new decorator |
| All non-auth controllers (admin, donor, beneficiary, CM) | Apply `@RequirePersona` |
| `Frontend/trini-thrive-fe/hope-card/middleware.ts` | New Next.js middleware |
