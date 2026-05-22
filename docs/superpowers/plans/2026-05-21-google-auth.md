# Google OAuth Sign-Up — Donor Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two endpoints to `hopecard-donor-service` — `GET /hopecard/donor/auth/google/url` and `GET /hopecard/donor/auth/google/callback` — that let a donor sign up or log in via Google OAuth, routed through the `@implementsprint/sdk` gauth wrappers.

**Architecture:** The donor service calls `TribeClient.gauthGetAuthorizationUrl` to get a Google consent URL, then on callback calls `TribeClient.gauthExchangeCode` to get an `idToken`, decodes the idToken with `jose.decodeJwt` to extract the donor's email and name, upserts a `digital_donor_profiles` row via Supabase admin, signs the same custom JWT used by existing login, and redirects the browser to the frontend success or error page.

**Tech Stack:** NestJS, `@implementsprint/sdk` (TribeClient), `@supabase/supabase-js`, `jose` (already installed), TypeScript

---

## File Map

| File | Change |
|---|---|
| `apps/hopecard-donor-service/src/auth/auth.service.ts` | Add `googleGetAuthUrl` and `googleCallback` methods |
| `apps/hopecard-donor-service/src/auth/auth.controller.ts` | Add two GET route handlers |
| `apps/hopecard-donor-service/src/auth/auth.service.spec.ts` | Add Google auth test cases |

No new files. No new modules. No schema changes. No new env vars.

---

## Task 1: Add failing tests for `googleGetAuthUrl`

**Files:**
- Modify: `apps/hopecard-donor-service/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Add SDK mock at the top of the spec file, after the existing `nodemailer` mock block (around line 57)**

Open `apps/hopecard-donor-service/src/auth/auth.service.spec.ts` and add this block immediately after the `jest.mock('nodemailer', ...)` block:

```ts
// ── SDK mock ──────────────────────────────────────────────────────────────────
const mockGauthGetAuthorizationUrl = jest.fn();
const mockGauthExchangeCode = jest.fn();

jest.mock('@implementsprint/sdk', () => ({
  TribeClient: jest.fn().mockImplementation(() => ({
    gauthGetAuthorizationUrl: mockGauthGetAuthorizationUrl,
    gauthExchangeCode: mockGauthExchangeCode,
  })),
}));
```

- [ ] **Step 2: Add `mockGauthGetAuthorizationUrl.mockReset()` and `mockGauthExchangeCode.mockReset()` to the `beforeEach` block**

Inside the existing `beforeEach` in `describe('AuthService (donor)')`, after `jest.clearAllMocks()`, add:

```ts
mockGauthGetAuthorizationUrl.mockReset();
mockGauthExchangeCode.mockReset();
```

- [ ] **Step 3: Add `googleGetAuthUrl` test suite at the bottom of `describe('AuthService (donor)')`**

```ts
// ── googleGetAuthUrl ──────────────────────────────────────────────────────────
describe('googleGetAuthUrl', () => {
  it('returns the authorization URL from the SDK', async () => {
    mockGauthGetAuthorizationUrl.mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/auth?foo=bar' });

    const result = await service.googleGetAuthUrl('https://api.example.com/hopecard/donor/auth/google/callback');

    expect(result).toEqual({ url: 'https://accounts.google.com/o/oauth2/auth?foo=bar' });
    expect(mockGauthGetAuthorizationUrl).toHaveBeenCalledWith({
      redirectUri: 'https://api.example.com/hopecard/donor/auth/google/callback',
      scopes: ['openid', 'email', 'profile'],
      accessType: 'offline',
    });
  });

  it('throws HttpException 502 when SDK call fails', async () => {
    mockGauthGetAuthorizationUrl.mockRejectedValue(new Error('APICenter unreachable'));

    await expect(
      service.googleGetAuthUrl('https://api.example.com/hopecard/donor/auth/google/callback'),
    ).rejects.toMatchObject({ status: 502 });
  });
});
```

- [ ] **Step 4: Run the new tests to confirm they fail**

```bash
cd apps/hopecard-donor-service
npx jest --testPathPattern="auth.service.spec" --testNamePattern="googleGetAuthUrl" --no-coverage
```

Expected: FAIL — `service.googleGetAuthUrl is not a function`

---

## Task 2: Implement `googleGetAuthUrl` in `AuthService`

**Files:**
- Modify: `apps/hopecard-donor-service/src/auth/auth.service.ts`

- [ ] **Step 1: Add the SDK import at the top of `auth.service.ts`**

After the existing imports, add:

```ts
import { TribeClient } from '@implementsprint/sdk';
```

- [ ] **Step 2: Add a private helper that builds a `TribeClient` instance**

Inside the `AuthService` class, after `getClients()`, add:

```ts
private getSdkClient() {
  return new TribeClient({
    gatewayUrl: process.env['APICENTER_URL']!,
    tribeId: process.env['APICENTER_TRIBE_ID']!,
    secret: process.env['APICENTER_TRIBE_SECRET']!,
  });
}
```

- [ ] **Step 3: Add the `googleGetAuthUrl` method**

After `getSdkClient()`, add:

```ts
async googleGetAuthUrl(callbackUrl: string) {
  const client = this.getSdkClient();
  try {
    const { url } = await client.gauthGetAuthorizationUrl({
      redirectUri: callbackUrl,
      scopes: ['openid', 'email', 'profile'],
      accessType: 'offline',
    });
    return { url };
  } catch {
    throw new HttpException('Failed to get Google authorization URL', 502);
  }
}
```

- [ ] **Step 4: Run the tests again to confirm they pass**

```bash
cd apps/hopecard-donor-service
npx jest --testPathPattern="auth.service.spec" --testNamePattern="googleGetAuthUrl" --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/hopecard-donor-service/src/auth/auth.service.ts apps/hopecard-donor-service/src/auth/auth.service.spec.ts
git commit -m "feat(donor-auth): add googleGetAuthUrl service method with tests"
```

---

## Task 3: Add failing tests for `googleCallback`

**Files:**
- Modify: `apps/hopecard-donor-service/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Add `jose.decodeJwt` to the jose mock**

The existing jose mock at the top of the file mocks `SignJWT`. Extend it to also export `decodeJwt`:

```ts
// Replace the existing jest.mock('jose', ...) block with:
jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
    capturedPayload = payload;
    return {
      setProtectedHeader: mockSetProtectedHeader,
      setExpirationTime: mockSetExpirationTime,
      sign: mockSign,
    };
  }),
  decodeJwt: jest.fn(),
}));
```

Then add a `mockDecodeJwt` handle near the top of the file (after the other mock fn declarations):

```ts
let mockDecodeJwt: jest.Mock;
```

And in `beforeEach`, after `jest.clearAllMocks()`, resolve the mock:

```ts
const joseMod = require('jose') as { decodeJwt: jest.Mock };
mockDecodeJwt = joseMod.decodeJwt;
mockDecodeJwt.mockReturnValue({
  sub: 'google-sub-123',
  email: 'donor@gmail.com',
  given_name: 'John',
  family_name: 'Doe',
  name: 'John Doe',
});
```

- [ ] **Step 2: Add `googleCallback` test suite at the bottom of `describe('AuthService (donor)')`**

```ts
// ── googleCallback ────────────────────────────────────────────────────────────
describe('googleCallback', () => {
  const callbackUrl = 'https://api.example.com/hopecard/donor/auth/google/callback';

  const setupExchange = () => {
    mockGauthExchangeCode.mockResolvedValue({
      accessToken: 'goog-access-tok',
      expiresIn: 3600,
      idToken: 'google.id.token',
    });
  };

  const setupCreateUser = () => {
    mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
    // admin.auth.admin.createUser — reuse mockUpdateUserById slot isn't available,
    // we need to add mockCreateUser to the mock setup (see step 3)
  };

  it('creates a new Supabase user and profile, returns success redirect URL', async () => {
    setupExchange();

    // No existing Supabase user
    mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
    // admin.auth.admin.createUser returns new user id
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'new-supa-uid' } }, error: null });

    // No existing profile in DB
    mockFrom.mockReturnValueOnce(makeChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));
    // Insert new profile
    mockFrom.mockReturnValueOnce(makeChain({
      insert: jest.fn().mockResolvedValue({ error: null }),
    }));

    const result = await service.googleCallback('auth-code-abc', callbackUrl);
    expect(result.redirectUrl).toContain('/auth/google/success');
    expect(result.redirectUrl).toContain('token=donor.jwt.token');
    expect(capturedPayload.persona).toBe('donor');
    expect(capturedPayload.system).toBe('hopecard');
    expect(capturedPayload.sub).toBe('new-supa-uid');
  });

  it('links existing unlinked profile and returns success redirect URL', async () => {
    setupExchange();

    // Existing Supabase user
    mockListUsers.mockResolvedValue({ data: { users: [{ id: 'existing-supa-uid', email: 'donor@gmail.com' }] }, error: null });

    // Profile exists but has no auth_user_id
    mockFrom.mockReturnValueOnce(makeChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'profile-1', auth_user_id: null, status: 'pending' }, error: null }),
    }));
    // Update auth_user_id
    const updateChain: any = { update: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockReturnValueOnce(updateChain);

    const result = await service.googleCallback('auth-code-abc', callbackUrl);
    expect(result.redirectUrl).toContain('pending_approval');
  });

  it('returns pending_approval redirect when existing linked profile is pending', async () => {
    setupExchange();

    mockListUsers.mockResolvedValue({ data: { users: [{ id: 'uid-99', email: 'donor@gmail.com' }] }, error: null });

    mockFrom.mockReturnValueOnce(makeChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'profile-2', auth_user_id: 'uid-99', status: 'pending' }, error: null }),
    }));

    const result = await service.googleCallback('auth-code-abc', callbackUrl);
    expect(result.redirectUrl).toContain('pending_approval');
  });

  it('returns success redirect when existing linked profile is approved', async () => {
    setupExchange();

    mockListUsers.mockResolvedValue({ data: { users: [{ id: 'uid-99', email: 'donor@gmail.com' }] }, error: null });

    mockFrom.mockReturnValueOnce(makeChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'profile-3', auth_user_id: 'uid-99', status: 'approved' }, error: null }),
    }));

    const result = await service.googleCallback('auth-code-abc', callbackUrl);
    expect(result.redirectUrl).toContain('/auth/google/success');
    expect(result.redirectUrl).toContain('token=donor.jwt.token');
  });

  it('returns code_exchange_failed redirect when SDK exchange throws', async () => {
    mockGauthExchangeCode.mockRejectedValue(new Error('invalid_grant'));

    const result = await service.googleCallback('bad-code', callbackUrl);
    expect(result.redirectUrl).toContain('code_exchange_failed');
  });

  it('returns no_email redirect when idToken has no email claim', async () => {
    mockGauthExchangeCode.mockResolvedValue({ accessToken: 'tok', expiresIn: 3600, idToken: 'id.tok' });
    mockDecodeJwt.mockReturnValue({ sub: 'sub-123' }); // no email

    const result = await service.googleCallback('code-abc', callbackUrl);
    expect(result.redirectUrl).toContain('no_email');
  });

  it('returns account_creation_failed redirect when Supabase createUser fails', async () => {
    setupExchange();
    mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mockCreateUser.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const result = await service.googleCallback('code-abc', callbackUrl);
    expect(result.redirectUrl).toContain('account_creation_failed');
  });

  it('returns profile_creation_failed redirect when insert fails', async () => {
    setupExchange();
    mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'new-uid' } }, error: null });

    mockFrom.mockReturnValueOnce(makeChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));
    mockFrom.mockReturnValueOnce(makeChain({
      insert: jest.fn().mockResolvedValue({ error: { message: 'unique violation' } }),
    }));

    const result = await service.googleCallback('code-abc', callbackUrl);
    expect(result.redirectUrl).toContain('profile_creation_failed');
  });
});
```

- [ ] **Step 3: Add `mockCreateUser` to the Supabase mock**

In the `jest.mock('@supabase/supabase-js', ...)` block, the `admin` object currently has `{ listUsers, updateUserById }`. Add `createUser`:

```ts
// At the top with the other mock fn declarations, add:
const mockCreateUser = jest.fn();
```

Then in `jest.mock('@supabase/supabase-js', ...)`, update the `admin` entry:

```ts
admin: { listUsers: mockListUsers, updateUserById: mockUpdateUserById, createUser: mockCreateUser },
```

Also add `mockCreateUser.mockReset()` in `beforeEach` alongside the other resets.

- [ ] **Step 4: Run the new tests to confirm they fail**

```bash
cd apps/hopecard-donor-service
npx jest --testPathPattern="auth.service.spec" --testNamePattern="googleCallback" --no-coverage
```

Expected: FAIL — `service.googleCallback is not a function`

---

## Task 4: Implement `googleCallback` in `AuthService`

**Files:**
- Modify: `apps/hopecard-donor-service/src/auth/auth.service.ts`

- [ ] **Step 1: Add `decodeJwt` to the jose import**

Change the existing jose import from:

```ts
import { SignJWT } from 'jose';
```

to:

```ts
import { SignJWT, decodeJwt } from 'jose';
```

- [ ] **Step 2: Add the `googleCallback` method to `AuthService`**

After `googleGetAuthUrl`, add:

```ts
async googleCallback(code: string, callbackUrl: string): Promise<{ redirectUrl: string }> {
  const successBase = `${process.env['NEXT_PUBLIC_APP_URL']}/auth/google/success`;
  const errorBase = `${process.env['NEXT_PUBLIC_APP_URL']}/auth/google/error`;

  // Exchange code for tokens
  let idToken: string;
  try {
    const tokens = await this.getSdkClient().gauthExchangeCode({ code, redirectUri: callbackUrl });
    if (!tokens.idToken) throw new Error('no idToken');
    idToken = tokens.idToken;
  } catch {
    return { redirectUrl: `${errorBase}?reason=code_exchange_failed` };
  }

  // Decode idToken to get profile
  let email: string;
  let firstName: string;
  let lastName: string;
  try {
    const claims = decodeJwt(idToken) as Record<string, string>;
    if (!claims.email) throw new Error('no email');
    email = claims.email;
    firstName = claims.given_name || (claims.name?.split(' ')[0] ?? '');
    lastName = claims.family_name || (claims.name?.split(' ').slice(1).join(' ') ?? '');
  } catch {
    return { redirectUrl: `${errorBase}?reason=no_email` };
  }

  const { admin } = this.getClients();

  // Find or create Supabase auth user
  let supabaseUserId: string;
  const { data: listData } = await admin.auth.admin.listUsers();
  const existingAuthUser = (listData?.users as any[] ?? []).find((u) => u.email === email);

  if (existingAuthUser) {
    supabaseUserId = existingAuthUser.id;
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createErr || !created?.user?.id) {
      return { redirectUrl: `${errorBase}?reason=account_creation_failed` };
    }
    supabaseUserId = created.user.id;
  }

  // Look up existing donor profile
  const { data: existingProfile } = await admin
    .from('digital_donor_profiles')
    .select('id, auth_user_id, status')
    .eq('email', email)
    .maybeSingle();

  if (existingProfile) {
    // Link auth_user_id if not yet linked
    if (!existingProfile.auth_user_id) {
      await admin
        .from('digital_donor_profiles')
        .update({ auth_user_id: supabaseUserId })
        .eq('email', email);
    }

    if (existingProfile.status !== 'approved') {
      return { redirectUrl: `${errorBase}?reason=${existingProfile.status === 'rejected' ? 'rejected' : 'pending_approval'}` };
    }
  } else {
    // Insert new profile
    const { error: insertErr } = await admin.from('digital_donor_profiles').insert({
      auth_user_id: supabaseUserId,
      email,
      first_name: firstName,
      last_name: lastName,
      barangay: null,
      municipality: null,
      province: null,
      id_verification_key: null,
      status: 'pending',
      role: 'buyer',
    });
    if (insertErr) {
      return { redirectUrl: `${errorBase}?reason=profile_creation_failed` };
    }
    return { redirectUrl: `${errorBase}?reason=pending_approval` };
  }

  // Issue JWT
  const token = await new SignJWT({
    sub: supabaseUserId,
    email,
    persona: 'donor',
    system: 'hopecard',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(getJwtSecret());

  return { redirectUrl: `${successBase}?token=${token}` };
}
```

- [ ] **Step 3: Run the `googleCallback` tests**

```bash
cd apps/hopecard-donor-service
npx jest --testPathPattern="auth.service.spec" --testNamePattern="googleCallback" --no-coverage
```

Expected: PASS (8 tests)

- [ ] **Step 4: Run the full service spec to confirm no regressions**

```bash
cd apps/hopecard-donor-service
npx jest --testPathPattern="auth.service.spec" --no-coverage
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/hopecard-donor-service/src/auth/auth.service.ts apps/hopecard-donor-service/src/auth/auth.service.spec.ts
git commit -m "feat(donor-auth): add googleCallback service method with tests"
```

---

## Task 5: Add controller routes and controller tests

**Files:**
- Modify: `apps/hopecard-donor-service/src/auth/auth.controller.ts`
- Create: `apps/hopecard-donor-service/src/auth/auth.controller.spec.ts`

- [ ] **Step 1: Add the two GET routes to `AuthController`**

Open `apps/hopecard-donor-service/src/auth/auth.controller.ts` and add `Get`, `Res`, `Redirect` to the NestJS imports, then add the two new handlers:

```ts
import { Controller, Post, Body, Req, Get, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('hopecard/donor/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ... existing handlers unchanged ...

  @Get('google/url')
  async googleUrl(@Req() req: any) {
    const callbackUrl = `${req.protocol}://${req.get('host')}/hopecard/donor/auth/google/callback`;
    return this.authService.googleGetAuthUrl(callbackUrl);
  }

  @Get('google/callback')
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const callbackUrl = `${req.protocol}://${req.get('host')}/hopecard/donor/auth/google/callback`;
    const { redirectUrl } = await this.authService.googleCallback(req.query.code as string, callbackUrl);
    return res.redirect(302, redirectUrl);
  }
}
```

- [ ] **Step 2: Write `auth.controller.spec.ts`**

Create `apps/hopecard-donor-service/src/auth/auth.controller.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  login: jest.fn(),
  signup: jest.fn(),
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  generateOtp: jest.fn(),
  verifyNumericOtp: jest.fn(),
  checkEmail: jest.fn(),
  resetPasswordWithOtp: jest.fn(),
  updatePassword: jest.fn(),
  uploadId: jest.fn(),
  googleGetAuthUrl: jest.fn(),
  googleCallback: jest.fn(),
};

describe('AuthController (donor)', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  describe('googleUrl', () => {
    it('calls googleGetAuthUrl with the derived callback URL and returns the result', async () => {
      mockAuthService.googleGetAuthUrl.mockResolvedValue({ url: 'https://accounts.google.com/...' });

      const req = { protocol: 'https', get: jest.fn().mockReturnValue('api.example.com') };
      const result = await controller.googleUrl(req);

      expect(mockAuthService.googleGetAuthUrl).toHaveBeenCalledWith(
        'https://api.example.com/hopecard/donor/auth/google/callback',
      );
      expect(result).toEqual({ url: 'https://accounts.google.com/...' });
    });
  });

  describe('googleCallback', () => {
    it('calls googleCallback with code and callback URL, then redirects 302', async () => {
      mockAuthService.googleCallback.mockResolvedValue({
        redirectUrl: 'https://app.example.com/auth/google/success?token=abc',
      });

      const req = {
        protocol: 'https',
        get: jest.fn().mockReturnValue('api.example.com'),
        query: { code: 'auth-code-xyz' },
      };
      const res = { redirect: jest.fn() };

      await controller.googleCallback(req, res as any);

      expect(mockAuthService.googleCallback).toHaveBeenCalledWith(
        'auth-code-xyz',
        'https://api.example.com/hopecard/donor/auth/google/callback',
      );
      expect(res.redirect).toHaveBeenCalledWith(302, 'https://app.example.com/auth/google/success?token=abc');
    });
  });
});
```

- [ ] **Step 3: Run the controller tests**

```bash
cd apps/hopecard-donor-service
npx jest --testPathPattern="auth.controller.spec" --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 4: Run the full donor auth test suite**

```bash
cd apps/hopecard-donor-service
npx jest --testPathPattern="auth\." --no-coverage
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/hopecard-donor-service/src/auth/auth.controller.ts apps/hopecard-donor-service/src/auth/auth.controller.spec.ts
git commit -m "feat(donor-auth): add Google OAuth controller routes with tests"
```

---

## Task 6: Full build verification

**Files:** None changed.

- [ ] **Step 1: Build the donor service**

From the repo root:

```bash
npx nx build hopecard-donor-service
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Run the full test suite for the donor service**

```bash
npx nx test hopecard-donor-service --coverage
```

Expected: All tests pass, coverage at or above the 80% threshold.

- [ ] **Step 3: Final commit if any lint fixes were needed; otherwise done**

If step 1 or 2 required small fixes, commit them:

```bash
git add -p
git commit -m "fix(donor-auth): resolve build/lint issues after Google auth integration"
```
