# Persona JWT Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce persona + system JWT claims end-to-end so no user can access another persona's backend endpoints or frontend dashboard.

**Architecture:** Every persona auth service issues a signed JWT containing `{ persona, system }` claims. The shared `JwtGuard` in `libs/common` is extended to optionally enforce those claims and throw 403 on mismatch. A Next.js `middleware.ts` in the hope-card frontend decodes the JWT cookie and redirects cross-persona URL navigation before the page renders.

**Tech Stack:** NestJS, jose (HS256 JWT), jest/ts-jest, Next.js 16, TypeScript.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `libs/common/src/guards/jwt.guard.ts` | Modify | Accept optional `expectedPersona`, throw 403 on mismatch |
| `libs/common/src/guards/jwt.guard.spec.ts` | Create | Unit tests for persona claim enforcement |
| `libs/common/src/decorators/require-persona.decorator.ts` | Create | `@RequirePersona(persona)` decorator |
| `libs/common/src/index.ts` | Modify | Export `RequirePersona` |
| `apps/hopecard-donor-service/src/auth/auth.service.ts` | Modify | Issue custom JWT with `persona:'donor'` in `login()` |
| `apps/hopecard-donor-service/src/auth/auth.service.spec.ts` | Create | Test donor JWT issuance |
| `apps/hopecard-beneficiary-service/src/auth/auth.service.ts` | Modify | Add `login()` method |
| `apps/hopecard-beneficiary-service/src/auth/auth.controller.ts` | Modify | Add `POST /auth/login` |
| `apps/hopecard-beneficiary-service/src/auth/auth.service.spec.ts` | Modify | Add `login()` tests |
| `apps/hopecard-campaign-manager-service/src/auth/auth.service.ts` | Modify | Add `login()` method |
| `apps/hopecard-campaign-manager-service/src/auth/auth.controller.ts` | Modify | Add `POST /auth/login` |
| `apps/hopecard-campaign-manager-service/src/auth/auth.service.spec.ts` | Modify | Add `login()` tests |
| All 11 non-auth controllers (admin×5, beneficiary×1, CM×2, donor×4) | Modify | Apply `@RequirePersona` at class level |
| `Frontend/trini-thrive-fe/hope-card/middleware.ts` | Create | Next.js persona-to-URL middleware |
| `Frontend/trini-thrive-fe/hope-card/tests/middleware.test.ts` | Create | Unit tests for middleware |

---

## Task 1: Upgrade JwtGuard to enforce persona/system claims

**Files:**
- Modify: `libs/common/src/guards/jwt.guard.ts`
- Create: `libs/common/src/guards/jwt.guard.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `libs/common/src/guards/jwt.guard.spec.ts`:

```typescript
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';

const mockJwtVerify = jest.fn();
jest.mock('jose', () => ({ jwtVerify: mockJwtVerify }));

function mockContext(authHeader?: string, cookies: Record<string, string> = {}) {
  const request: any = { headers: {}, cookies, user: undefined };
  if (authHeader) request.headers.authorization = authHeader;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtGuard', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    jest.clearAllMocks();
  });

  describe('no token', () => {
    it('throws UnauthorizedException with MISSING_AUTH_TOKEN', async () => {
      const guard = new JwtGuard();
      await expect(guard.canActivate(mockContext())).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('invalid token', () => {
    it('throws UnauthorizedException with INVALID_JWT', async () => {
      mockJwtVerify.mockRejectedValue(new Error('signature mismatch'));
      const guard = new JwtGuard();
      await expect(guard.canActivate(mockContext('Bearer bad.token'))).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('valid token, no expectedPersona', () => {
    it('passes and sets request.user', async () => {
      const payload = { sub: 'u1', email: 'a@b.com', persona: 'admin', system: 'hopecard' };
      mockJwtVerify.mockResolvedValue({ payload });
      const ctx = mockContext('Bearer valid.token');
      const guard = new JwtGuard();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(ctx.switchToHttp().getRequest().user).toEqual(payload);
    });
  });

  describe('valid token, expectedPersona matches', () => {
    it('passes when persona and system match', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'u1', email: 'a@b.com', persona: 'donor', system: 'hopecard' },
      });
      const guard = new JwtGuard('donor');
      const result = await guard.canActivate(mockContext('Bearer valid.token'));
      expect(result).toBe(true);
    });
  });

  describe('valid token, persona mismatch', () => {
    it('throws ForbiddenException with PERSONA_MISMATCH when persona is wrong', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'u1', email: 'a@b.com', persona: 'donor', system: 'hopecard' },
      });
      const guard = new JwtGuard('admin');
      await expect(guard.canActivate(mockContext('Bearer valid.token'))).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException with PERSONA_MISMATCH when system is wrong', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'u1', email: 'a@b.com', persona: 'admin', system: 'other-system' },
      });
      const guard = new JwtGuard('admin');
      await expect(guard.canActivate(mockContext('Bearer valid.token'))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cookie fallback', () => {
    it('reads token from admin_token cookie', async () => {
      const payload = { sub: 'u1', email: 'a@b.com', persona: 'admin', system: 'hopecard' };
      mockJwtVerify.mockResolvedValue({ payload });
      const guard = new JwtGuard();
      const result = await guard.canActivate(mockContext(undefined, { admin_token: 'cookie.token' }));
      expect(result).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (JwtGuard constructor doesn't accept args yet)**

```bash
npx jest --selectProjects api --testPathPattern="jwt.guard.spec" --no-coverage
```

Expected: multiple failures including "constructor does not accept arguments" or unexpected pass without persona checks.

- [ ] **Step 3: Replace `libs/common/src/guards/jwt.guard.ts`**

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env['JWT_SECRET'] ?? '');

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  persona: string;
  system: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly expectedPersona?: string) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException({
        message: 'No JWT token provided',
        error: 'MISSING_TOKEN',
        code: 'MISSING_AUTH_TOKEN',
      });
    }

    let payload: JwtPayload;
    try {
      const verified = await jwtVerify(token, JWT_SECRET);
      payload = verified.payload as JwtPayload;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      let detail = 'Invalid or expired JWT token';
      if (msg.includes('signature')) detail = 'Invalid token signature';
      else if (msg.includes('exp')) detail = 'Token has expired';
      else if (msg.includes('malformed')) detail = 'Malformed token format';
      throw new UnauthorizedException({ message: detail, error: 'INVALID_TOKEN', code: 'INVALID_JWT' });
    }

    if (this.expectedPersona) {
      if (payload.persona !== this.expectedPersona || payload.system !== 'hopecard') {
        throw new ForbiddenException({ message: 'Persona mismatch', code: 'PERSONA_MISMATCH' });
      }
    }

    request.user = payload;
    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);
    if (request.cookies?.admin_token) return request.cookies.admin_token;
    return undefined;
  }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npx jest --selectProjects api --testPathPattern="jwt.guard.spec" --no-coverage
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/common/src/guards/jwt.guard.ts libs/common/src/guards/jwt.guard.spec.ts
git commit -m "feat(common): extend JwtGuard to enforce persona/system claims with 403"
```

---

## Task 2: Add `@RequirePersona` decorator and export it

**Files:**
- Create: `libs/common/src/decorators/require-persona.decorator.ts`
- Modify: `libs/common/src/index.ts`

- [ ] **Step 1: Create `libs/common/src/decorators/require-persona.decorator.ts`**

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtGuard } from '../guards/jwt.guard';

export const RequirePersona = (persona: string) => UseGuards(new JwtGuard(persona));
```

- [ ] **Step 2: Add export to `libs/common/src/index.ts`**

Open `libs/common/src/index.ts` and append at the end:

```typescript
export * from './decorators/require-persona.decorator';
```

- [ ] **Step 3: Verify the full common lib still compiles**

```bash
npx tsc --project libs/common/tsconfig.lib.json --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add libs/common/src/decorators/require-persona.decorator.ts libs/common/src/index.ts
git commit -m "feat(common): add RequirePersona decorator for persona-scoped route protection"
```

---

## Task 3: Donor service — issue custom JWT in `login()`

**Files:**
- Modify: `apps/hopecard-donor-service/src/auth/auth.service.ts`
- Create: `apps/hopecard-donor-service/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/hopecard-donor-service/src/auth/auth.service.spec.ts`:

```typescript
import { AuthService } from './auth.service';

// jose mock
const mockSign = jest.fn().mockResolvedValue('donor.jwt.token');
const mockSetExpirationTime = jest.fn().mockReturnThis();
const mockSetProtectedHeader = jest.fn().mockReturnThis();
let capturedPayload: Record<string, unknown> = {};

jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
    capturedPayload = payload;
    return {
      setProtectedHeader: mockSetProtectedHeader,
      setExpirationTime: mockSetExpirationTime,
      sign: mockSign,
    };
  }),
}));

// supabase mock
const mockSignInWithPassword = jest.fn();
const mockFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { signInWithPassword: mockSignInWithPassword },
    from: mockFrom,
  })),
}));

// nodemailer mock
jest.mock('nodemailer', () => ({
  default: { createTransport: jest.fn(() => ({ sendMail: jest.fn() })) },
}));

describe('AuthService (donor)', () => {
  let service: AuthService;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';
    process.env.JWT_SECRET = 'test-secret';
    capturedPayload = {};
    jest.clearAllMocks();

    const { SignJWT } = require('jose') as { SignJWT: jest.Mock };
    SignJWT.mockImplementation((payload: Record<string, unknown>) => {
      capturedPayload = payload;
      return {
        setProtectedHeader: mockSetProtectedHeader,
        setExpirationTime: mockSetExpirationTime,
        sign: mockSign,
      };
    });
    mockSetProtectedHeader.mockReturnThis();
    mockSetExpirationTime.mockReturnThis();
    mockSign.mockResolvedValue('donor.jwt.token');

    service = new AuthService();
  });

  describe('login', () => {
    const profileChain = () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { status: 'approved', role: 'buyer' }, error: null }),
      };
      return chain;
    };

    it('returns token with persona:donor and system:hopecard on successful login', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-1', email: 'donor@test.com' }, session: {} },
        error: null,
      });
      mockFrom.mockReturnValue(profileChain());

      const result = await service.login('donor@test.com', 'pass123');

      expect(result.success).toBe(true);
      expect(result.token).toBe('donor.jwt.token');
      expect(capturedPayload.persona).toBe('donor');
      expect(capturedPayload.system).toBe('hopecard');
      expect(capturedPayload.sub).toBe('uid-1');
    });

    it('throws 401 when Supabase signIn fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' },
      });
      await expect(service.login('x@y.com', 'bad')).rejects.toMatchObject({ status: 401 });
    });

    it('throws 403 when donor profile not found', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-2', email: 'x@y.com' }, session: {} },
        error: null,
      });
      const notFoundChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };
      mockFrom.mockReturnValue(notFoundChain);
      await expect(service.login('x@y.com', 'pass')).rejects.toMatchObject({ status: 403 });
    });

    it('throws 403 when donor account is not approved', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-3', email: 'x@y.com' }, session: {} },
        error: null,
      });
      const pendingChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { status: 'pending', role: 'buyer' }, error: null }),
      };
      mockFrom.mockReturnValue(pendingChain);
      await expect(service.login('x@y.com', 'pass')).rejects.toMatchObject({ status: 403 });
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (login() doesn't return a token yet)**

```bash
npx jest --selectProjects hopecard-donor-service --testPathPattern="auth.service.spec" --no-coverage
```

Expected: fail — `result.token` is undefined.

- [ ] **Step 3: Modify `apps/hopecard-donor-service/src/auth/auth.service.ts`**

Add `SignJWT` import and `JWT_SECRET` at the top, then replace the `login()` method body. The new file top section:

```typescript
import { Injectable, HttpException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import nodemailer from 'nodemailer';

const JWT_SECRET = () => new TextEncoder().encode(process.env['JWT_SECRET'] ?? '');
```

Replace the entire `login()` method (lines 17–63 of the original) with:

```typescript
  async login(email: string, password: string) {
    const { supabase, admin } = this.getClients();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new HttpException(error.message, 401);

    const userId = data.user?.id;
    const userEmail = data.user?.email || email;

    let { data: profileData, error: profileError } = await admin
      .from('digital_donor_profiles')
      .select('status, role')
      .eq('auth_user_id', userId)
      .single();

    if (profileError || !profileData) {
      const { data: emailProfile, error: emailError } = await admin
        .from('digital_donor_profiles')
        .select('status, role, auth_user_id')
        .eq('email', userEmail)
        .single();

      if (!emailError && emailProfile) {
        profileData = emailProfile;
        profileError = null;
        await admin.from('digital_donor_profiles').update({ auth_user_id: userId }).eq('email', userEmail);
      }
    }

    if (profileError || !profileData) {
      throw new HttpException('Donor profile not found. Please ensure you have completed the signup process or contact support.', 403);
    }

    if (profileData?.status !== 'approved') {
      throw new HttpException({ error: 'Your account is not yet approved', reason: 'pending_approval', status: profileData?.status || 'unknown' }, 403);
    }

    const token = await new SignJWT({
      sub: userId,
      email: userEmail,
      persona: 'donor',
      system: 'hopecard',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(JWT_SECRET());

    return { success: true, token, user: data.user };
  }
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npx jest --selectProjects hopecard-donor-service --testPathPattern="auth.service.spec" --no-coverage
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/hopecard-donor-service/src/auth/auth.service.ts apps/hopecard-donor-service/src/auth/auth.service.spec.ts
git commit -m "feat(donor-auth): issue persona JWT with donor/hopecard claims on login"
```

---

## Task 4: Beneficiary service — add login endpoint

**Files:**
- Modify: `apps/hopecard-beneficiary-service/src/auth/auth.service.ts`
- Modify: `apps/hopecard-beneficiary-service/src/auth/auth.controller.ts`
- Modify: `apps/hopecard-beneficiary-service/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to `apps/hopecard-beneficiary-service/src/auth/auth.service.spec.ts`, inside `describe('AuthService (Beneficiary)')`, after the existing `describe` blocks:

```typescript
  // ── login ───────────────────────────────────────────────────────────────────
  describe('login', () => {
    // jose mock — must be at top of file; add this to the module-level mocks:
    // jest.mock('jose', ...) — see Step 3 for full file header
  });
```

Because `jose` is ESM-only and must be mocked at the module level, you need to add the jose mock to the **top** of the spec file. Replace the entire `apps/hopecard-beneficiary-service/src/auth/auth.service.spec.ts` file with:

```typescript
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';

// ── jose mock (ESM-only) ─────────────────────────────────────────────────────
const mockJoseSign = jest.fn().mockResolvedValue('beneficiary.jwt.token');
const mockSetExpirationTime = jest.fn().mockReturnThis();
const mockSetProtectedHeader = jest.fn().mockReturnThis();
let capturedJosePayload: Record<string, unknown> = {};

jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
    capturedJosePayload = payload;
    return {
      setProtectedHeader: mockSetProtectedHeader,
      setExpirationTime: mockSetExpirationTime,
      sign: mockJoseSign,
    };
  }),
}));

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockMaybeSingle = jest.fn();
const mockInsert = jest.fn();
const mockUpdateChain = { eq: jest.fn().mockReturnThis() };
const mockDeleteChain = { eq: jest.fn().mockReturnThis() };
const mockSupabaseChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  delete: jest.fn(() => mockDeleteChain),
  update: jest.fn(() => mockUpdateChain),
  maybeSingle: mockMaybeSingle,
  insert: mockInsert,
};
const mockSignInWithPassword = jest.fn();
const mockAuthAdmin = { updateUserById: jest.fn() };
const mockSupabase = {
  from: jest.fn(() => mockSupabaseChain),
  auth: { signInWithPassword: mockSignInWithPassword, admin: mockAuthAdmin },
};
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// ── nodemailer mock ──────────────────────────────────────────────────────────
const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

// ── jsonwebtoken mock ────────────────────────────────────────────────────────
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));
const jwtMod = require('jsonwebtoken') as { sign: jest.Mock; verify: jest.Mock };

describe('AuthService (Beneficiary)', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    capturedJosePayload = {};
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';
    process.env.JWT_SECRET = 'test-secret';
    process.env.RESET_TOKEN_SECRET = 'test-secret';
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASSWORD = 'p';
    process.env.SMTP_FROM = 'noreply@test.com';

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockDeleteChain.eq.mockReturnThis();
    mockUpdateChain.eq.mockResolvedValue({ data: null, error: null });
    mockSignInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'default' } });

    const { SignJWT } = require('jose') as { SignJWT: jest.Mock };
    SignJWT.mockImplementation((payload: Record<string, unknown>) => {
      capturedJosePayload = payload;
      return {
        setProtectedHeader: mockSetProtectedHeader,
        setExpirationTime: mockSetExpirationTime,
        sign: mockJoseSign,
      };
    });
    mockSetProtectedHeader.mockReturnThis();
    mockSetExpirationTime.mockReturnThis();
    mockJoseSign.mockResolvedValue('beneficiary.jwt.token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  // ── login ───────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns token with persona:beneficiary and system:hopecard on success', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-b1', email: 'ben@test.com' } },
        error: null,
      });
      mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'profile-1' }, error: null });

      const result = await service.login('ben@test.com', 'pass123');

      expect(result.success).toBe(true);
      expect(result.token).toBe('beneficiary.jwt.token');
      expect(capturedJosePayload.persona).toBe('beneficiary');
      expect(capturedJosePayload.system).toBe('hopecard');
      expect(capturedJosePayload.sub).toBe('uid-b1');
    });

    it('throws UnauthorizedException when Supabase signIn fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });
      await expect(service.login('x@y.com', 'bad')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when beneficiary_profiles row not found', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-b2', email: 'x@y.com' } },
        error: null,
      });
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.login('x@y.com', 'pass')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws InternalServerErrorException on DB error during profile lookup', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uid-b3', email: 'x@y.com' } },
        error: null,
      });
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
      await expect(service.login('x@y.com', 'pass')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── forgotPassword ──────────────────────────────────────────────────────────
  describe('forgotPassword', () => {
    it('returns success when email exists and OTP is sent', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockInsert.mockResolvedValueOnce({ error: null });
      mockSendMail.mockResolvedValue({ messageId: 'msg-1' });

      const result = await service.forgotPassword('test@email.com');
      expect(result.success).toBe(true);
      expect(result.message).toContain('verification code');
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.forgotPassword('nobody@email.com')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws InternalServerErrorException on profile DB error', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB err' } });
      await expect(service.forgotPassword('x@y.com')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws InternalServerErrorException when OTP insert fails', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockInsert.mockResolvedValueOnce({ error: { message: 'insert fail' } });
      await expect(service.forgotPassword('x@y.com')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws InternalServerErrorException when email sending fails', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
      mockInsert.mockResolvedValueOnce({ error: null });
      mockSendMail.mockRejectedValue(new Error('SMTP error'));
      await expect(service.forgotPassword('x@y.com')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── verifyResetOtp ──────────────────────────────────────────────────────────
  describe('verifyResetOtp', () => {
    it('returns a signed reset token on valid OTP', async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: 'otp-1', expires_at_ms: Date.now() + 60_000 },
        error: null,
      });
      mockUpdateChain.eq.mockResolvedValueOnce({ data: null, error: null });
      jwtMod.sign.mockReturnValue('signed-token');

      const result = await service.verifyResetOtp('x@y.com', '123456');
      expect(result.reset_token).toBe('signed-token');
    });

    it('throws InternalServerErrorException on DB error', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'err' } });
      await expect(service.verifyResetOtp('x@y.com', '123456')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws BadRequestException when OTP is not found', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.verifyResetOtp('x@y.com', 'bad')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when OTP is expired', async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: 'otp-2', expires_at_ms: Date.now() - 1 },
        error: null,
      });
      await expect(service.verifyResetOtp('x@y.com', '123456')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws InternalServerErrorException when RESET_TOKEN_SECRET is missing', async () => {
      delete process.env.RESET_TOKEN_SECRET;
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: 'otp-3', expires_at_ms: Date.now() + 60_000 },
        error: null,
      });
      mockUpdateChain.eq.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.verifyResetOtp('x@y.com', '123456')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── resetPassword ────────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    it('resets password successfully with valid token', async () => {
      jwtMod.verify.mockReturnValue({ sub: 'x@y.com', purpose: 'password_reset' });
      mockMaybeSingle.mockResolvedValueOnce({ data: { auth_user_id: 'auth-uid-1' }, error: null });
      mockAuthAdmin.updateUserById.mockResolvedValue({ error: null });

      const result = await service.resetPassword('valid-token', 'NewPass123!');
      expect(result.success).toBe(true);
    });

    it('throws InternalServerErrorException when RESET_TOKEN_SECRET is missing', async () => {
      delete process.env.RESET_TOKEN_SECRET;
      await expect(service.resetPassword('tok', 'pass')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws UnauthorizedException on invalid JWT', async () => {
      jwtMod.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.resetPassword('bad-token', 'pass')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when token purpose is wrong', async () => {
      jwtMod.verify.mockReturnValue({ sub: 'x@y.com', purpose: 'other' });
      await expect(service.resetPassword('tok', 'pass')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws NotFoundException when profile is not found', async () => {
      jwtMod.verify.mockReturnValue({ sub: 'x@y.com', purpose: 'password_reset' });
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.resetPassword('tok', 'pass')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws InternalServerErrorException when auth update fails', async () => {
      jwtMod.verify.mockReturnValue({ sub: 'x@y.com', purpose: 'password_reset' });
      mockMaybeSingle.mockResolvedValueOnce({ data: { auth_user_id: 'uid' }, error: null });
      mockAuthAdmin.updateUserById.mockResolvedValue({ error: { message: 'update fail' } });
      await expect(service.resetPassword('tok', 'pass')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws NotFoundException on profile DB error', async () => {
      jwtMod.verify.mockReturnValue({ sub: 'x@y.com', purpose: 'password_reset' });
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'db err' } });
      await expect(service.resetPassword('tok', 'pass')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (`login` not found on AuthService)**

```bash
npx jest --selectProjects hopecard-beneficiary-service --testPathPattern="auth.service.spec" --no-coverage
```

Expected: fail — `service.login is not a function`.

- [ ] **Step 3: Add `login()` to `apps/hopecard-beneficiary-service/src/auth/auth.service.ts`**

Add to the top imports:

```typescript
import { SignJWT } from 'jose';
import { UnauthorizedException } from '@nestjs/common';
```

Modify the existing imports line (which currently reads `import { BadRequestException, Injectable, ... }`) to also include `UnauthorizedException` if not already there.

Add this method to the `AuthService` class, after the existing `resetPassword` method:

```typescript
  async login(email: string, password: string): Promise<{ success: boolean; token: string }> {
    const admin = this.admin;

    const { data, error } = await admin.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { data: profile, error: profileError } = await admin
      .from('beneficiary_profiles')
      .select('id')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException('Database error');
    }
    if (!profile) {
      throw new UnauthorizedException('No beneficiary account found for this email');
    }

    const secret = process.env['JWT_SECRET'];
    if (!secret) throw new InternalServerErrorException('JWT_SECRET not configured');

    const token = await new SignJWT({
      sub: data.user.id,
      email: data.user.email,
      persona: 'beneficiary',
      system: 'hopecard',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(secret));

    return { success: true, token };
  }
```

- [ ] **Step 4: Add `POST /auth/login` to `apps/hopecard-beneficiary-service/src/auth/auth.controller.ts`**

Add `Post, Body` to the existing import, then add the endpoint:

```typescript
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('verify-reset-otp')
  @HttpCode(200)
  verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(dto.email, dto.otp);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.reset_token, dto.new_password);
  }
}
```

- [ ] **Step 5: Run tests — expect all pass**

```bash
npx jest --selectProjects hopecard-beneficiary-service --no-coverage
```

Expected: all tests pass (existing + 4 new login tests).

- [ ] **Step 6: Commit**

```bash
git add apps/hopecard-beneficiary-service/src/auth/auth.service.ts apps/hopecard-beneficiary-service/src/auth/auth.controller.ts apps/hopecard-beneficiary-service/src/auth/auth.service.spec.ts
git commit -m "feat(beneficiary-auth): add login endpoint issuing persona JWT with beneficiary/hopecard claims"
```

---

## Task 5: Campaign Manager service — add login endpoint

**Files:**
- Modify: `apps/hopecard-campaign-manager-service/src/auth/auth.service.ts`
- Modify: `apps/hopecard-campaign-manager-service/src/auth/auth.controller.ts`
- Modify: `apps/hopecard-campaign-manager-service/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Replace the entire `apps/hopecard-campaign-manager-service/src/auth/auth.service.spec.ts` with:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

// ── jose mock (ESM-only) ─────────────────────────────────────────────────────
const mockJoseSign = jest.fn().mockResolvedValue('cm.jwt.token');
const mockSetExpirationTime = jest.fn().mockReturnThis();
const mockSetProtectedHeader = jest.fn().mockReturnThis();
let capturedJosePayload: Record<string, unknown> = {};

jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
    capturedJosePayload = payload;
    return {
      setProtectedHeader: mockSetProtectedHeader,
      setExpirationTime: mockSetExpirationTime,
      sign: mockJoseSign,
    };
  }),
}));

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockSignInWithPassword = jest.fn();
const mockFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { signInWithPassword: mockSignInWithPassword },
    from: mockFrom,
  })),
}));

function selectChain(result: { data: any; error: any }) {
  const c: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return c;
}

const mockConfigService = {
  get: (k: string) =>
    ({
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
      JWT_SECRET: 'test-secret',
    })[k],
};

describe('AuthService (CM)', () => {
  let service: AuthService;

  beforeEach(async () => {
    mockFrom.mockReset();
    mockSignInWithPassword.mockReset();
    capturedJosePayload = {};
    jest.clearAllMocks();

    const { SignJWT } = require('jose') as { SignJWT: jest.Mock };
    SignJWT.mockImplementation((payload: Record<string, unknown>) => {
      capturedJosePayload = payload;
      return {
        setProtectedHeader: mockSetProtectedHeader,
        setExpirationTime: mockSetExpirationTime,
        sign: mockJoseSign,
      };
    });
    mockSetProtectedHeader.mockReturnThis();
    mockSetExpirationTime.mockReturnThis();
    mockJoseSign.mockResolvedValue('cm.jwt.token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    (service as any).supabase = {
      auth: { signInWithPassword: mockSignInWithPassword },
      from: mockFrom,
    };
  });

  // ── login ───────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns token with persona:cm and system:hopecard on success', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'cm-uid-1', email: 'cm@test.com' } },
        error: null,
      });
      mockFrom.mockReturnValue(selectChain({ data: { id: 'profile-1' }, error: null }));

      const result = await service.login('cm@test.com', 'pass123');

      expect(result.success).toBe(true);
      expect(result.token).toBe('cm.jwt.token');
      expect(capturedJosePayload.persona).toBe('cm');
      expect(capturedJosePayload.system).toBe('hopecard');
      expect(capturedJosePayload.sub).toBe('cm-uid-1');
    });

    it('throws UnauthorizedException when Supabase signIn fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' },
      });
      await expect(service.login('x@y.com', 'bad')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when campaign_manager_profiles row not found', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'cm-uid-2', email: 'x@y.com' } },
        error: null,
      });
      mockFrom.mockReturnValue(selectChain({ data: null, error: null }));
      await expect(service.login('x@y.com', 'pass')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws InternalServerErrorException on DB error during profile lookup', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'cm-uid-3', email: 'x@y.com' } },
        error: null,
      });
      mockFrom.mockReturnValue(selectChain({ data: null, error: { message: 'DB err' } }));
      await expect(service.login('x@y.com', 'pass')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── getManagerProfile ───────────────────────────────────────────────────────
  describe('getManagerProfile', () => {
    it('returns profile data on success', async () => {
      mockFrom.mockReturnValueOnce(
        selectChain({ data: { first_name: 'Jane' }, error: null }),
      );
      const result = await service.getManagerProfile('uid-1');
      expect(result).toEqual({ first_name: 'Jane' });
      expect(mockFrom).toHaveBeenCalledWith('campaign_manager_profiles');
    });

    it('throws InternalServerErrorException on DB error', async () => {
      mockFrom.mockReturnValueOnce(
        selectChain({ data: null, error: { message: 'DB failure' } }),
      );
      await expect(service.getManagerProfile('uid-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── getBeneficiaryProfiles ──────────────────────────────────────────────────
  describe('getBeneficiaryProfiles', () => {
    it('fetches all profiles without status filter', async () => {
      const c: any = {
        select: jest.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      };
      mockFrom.mockReturnValueOnce(c);
      const result = await service.getBeneficiaryProfiles();
      expect(result).toEqual([{ id: '1' }]);
    });

    it('filters by status when provided', async () => {
      const c: any = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [{ id: '2', status: 'approved' }], error: null }),
        }),
      };
      mockFrom.mockReturnValueOnce(c);
      const result = await service.getBeneficiaryProfiles('approved');
      expect(result).toEqual([{ id: '2', status: 'approved' }]);
    });

    it('throws InternalServerErrorException on DB error', async () => {
      const c: any = {
        select: jest.fn().mockResolvedValue({ data: null, error: { message: 'err' } }),
      };
      mockFrom.mockReturnValueOnce(c);
      await expect(service.getBeneficiaryProfiles()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('onModuleInit — missing env vars', () => {
    it('logs error and skips client creation when env vars absent', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mod = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
        ],
      }).compile();
      expect(mod.get<AuthService>(AuthService)).toBeDefined();
      spy.mockRestore();
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (`login` not found)**

```bash
npx jest --selectProjects hopecard-campaign-manager-service --testPathPattern="auth.service.spec" --no-coverage
```

Expected: fail — `service.login is not a function`.

- [ ] **Step 3: Add `login()` to `apps/hopecard-campaign-manager-service/src/auth/auth.service.ts`**

Add imports at the top of the file:

```typescript
import { Injectable, InternalServerErrorException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
```

Add this method to the `AuthService` class, before `getManagerProfile`:

```typescript
  async login(email: string, password: string): Promise<{ success: boolean; token: string }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { data: profile, error: profileError } = await this.supabase
      .from('campaign_manager_profiles')
      .select('id')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();

    if (profileError) throw new InternalServerErrorException(profileError.message);
    if (!profile) throw new UnauthorizedException('No campaign manager account found for this email');

    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) throw new InternalServerErrorException('JWT_SECRET not configured');

    const token = await new SignJWT({
      sub: data.user.id,
      email: data.user.email,
      persona: 'cm',
      system: 'hopecard',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(secret));

    return { success: true, token };
  }
```

Note: `this.supabase` is set in `onModuleInit`. The `maybeSingle()` method must be available on the chain — verify the existing `selectChain` mock in the spec returns it. (The spec above already mocks `maybeSingle`.)

- [ ] **Step 4: Add `POST /auth/login` to `apps/hopecard-campaign-manager-service/src/auth/auth.controller.ts`**

Replace the entire file:

```typescript
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Get('manager/:authUserId')
  async getManagerProfile(@Param('authUserId') authUserId: string) {
    return this.authService.getManagerProfile(authUserId);
  }

  @Get('beneficiaries')
  async getBeneficiaryProfiles(@Query('status') status: string) {
    return this.authService.getBeneficiaryProfiles(status);
  }
}
```

- [ ] **Step 5: Run tests — expect all pass**

```bash
npx jest --selectProjects hopecard-campaign-manager-service --no-coverage
```

Expected: all tests pass (existing + 4 new login tests).

- [ ] **Step 6: Commit**

```bash
git add apps/hopecard-campaign-manager-service/src/auth/auth.service.ts apps/hopecard-campaign-manager-service/src/auth/auth.controller.ts apps/hopecard-campaign-manager-service/src/auth/auth.service.spec.ts
git commit -m "feat(cm-auth): add login endpoint issuing persona JWT with cm/hopecard claims"
```

---

## Task 6: Apply `@RequirePersona` to all non-auth controllers

**Files (all modify only — add one decorator line to each):**

Admin (5 controllers):
- `apps/hopecard-admin-service/src/analytics/activity.controller.ts`
- `apps/hopecard-admin-service/src/analytics/dashboard.controller.ts`
- `apps/hopecard-admin-service/src/approvals/beneficiary-approvals.controller.ts`
- `apps/hopecard-admin-service/src/approvals/campaign-manager-approvals.controller.ts`
- `apps/hopecard-admin-service/src/approvals/digital-donor-approvals.controller.ts`
- `apps/hopecard-admin-service/src/beneficiary-management/beneficiaries.controller.ts`
- `apps/hopecard-admin-service/src/beneficiary-management/campaigns.controller.ts`

Beneficiary (1 controller):
- `apps/hopecard-beneficiary-service/src/beneficiary-health/health.controller.ts`

Campaign Manager (2 controllers):
- `apps/hopecard-campaign-manager-service/src/campaigns/campaigns.controller.ts`
- `apps/hopecard-campaign-manager-service/src/reporting/reporting.controller.ts`

Donor (4 controllers):
- `apps/hopecard-donor-service/src/campaigns/campaigns.controller.ts`
- `apps/hopecard-donor-service/src/cart/cart.controller.ts`
- `apps/hopecard-donor-service/src/profile/profile.controller.ts`
- `apps/hopecard-donor-service/src/purchases/purchases.controller.ts`

- [ ] **Step 1: Add `@RequirePersona('admin')` to all 7 admin non-auth controllers**

For each admin controller file, add the import and decorator. Pattern to apply (same for all 7):

```typescript
// Add to imports:
import { RequirePersona } from '@app/common';

// Add above the @Controller(...) line:
@RequirePersona('admin')
```

Example — `apps/hopecard-admin-service/src/analytics/activity.controller.ts` before change:
```typescript
import { Controller, Get, ... } from '@nestjs/common';
// ...
@Controller('analytics/activity')
export class ActivityController {
```

After change:
```typescript
import { Controller, Get, ... } from '@nestjs/common';
import { RequirePersona } from '@app/common';
// ...
@RequirePersona('admin')
@Controller('analytics/activity')
export class ActivityController {
```

Apply this same pattern to all 7 admin controllers.

- [ ] **Step 2: Add `@RequirePersona('beneficiary')` to the beneficiary health controller**

`apps/hopecard-beneficiary-service/src/beneficiary-health/health.controller.ts`:

```typescript
import { RequirePersona } from '@app/common';

@RequirePersona('beneficiary')
@Controller(...)   // keep existing @Controller line unchanged
export class HealthController {
```

- [ ] **Step 3: Add `@RequirePersona('cm')` to both CM non-auth controllers**

`apps/hopecard-campaign-manager-service/src/campaigns/campaigns.controller.ts` and `apps/hopecard-campaign-manager-service/src/reporting/reporting.controller.ts`:

```typescript
import { RequirePersona } from '@app/common';

@RequirePersona('cm')
@Controller(...)   // keep existing @Controller line unchanged
```

- [ ] **Step 4: Add `@RequirePersona('donor')` to all 4 donor non-auth controllers**

`campaigns.controller.ts`, `cart.controller.ts`, `profile.controller.ts`, `purchases.controller.ts` under `apps/hopecard-donor-service/src/`:

```typescript
import { RequirePersona } from '@app/common';

@RequirePersona('donor')
@Controller(...)   // keep existing @Controller line unchanged
```

- [ ] **Step 5: Run the full test suite for all persona services**

```bash
npx jest --selectProjects hopecard-admin-service hopecard-beneficiary-service hopecard-campaign-manager-service hopecard-donor-service --no-coverage
```

Expected: all existing tests pass (the decorator only affects runtime NestJS metadata, not unit test logic).

- [ ] **Step 6: Commit**

```bash
git add apps/hopecard-admin-service/src/ apps/hopecard-beneficiary-service/src/ apps/hopecard-campaign-manager-service/src/ apps/hopecard-donor-service/src/
git commit -m "feat(security): apply RequirePersona guard to all non-auth controllers across all persona services"
```

---

## Task 7: Frontend — Next.js persona middleware

**Files:**
- Create: `Frontend/trini-thrive-fe/hope-card/middleware.ts`
- Create: `Frontend/trini-thrive-fe/hope-card/tests/middleware.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `Frontend/trini-thrive-fe/hope-card/tests/middleware.test.ts`:

```typescript
/**
 * Tests for middleware.ts persona enforcement.
 * NextRequest/NextResponse are mocked because the Edge runtime
 * is not available in jest-jsdom.
 */

// Build a minimal base64url-encoded JWT with the given payload
function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

// ── Next.js mocks ─────────────────────────────────────────────────────────────
const mockRedirect = jest.fn();
const mockNext = jest.fn();

jest.mock('next/server', () => {
  class NextResponse {
    static redirect(url: URL) {
      mockRedirect(url.pathname);
      return { type: 'redirect', url };
    }
    static next() {
      mockNext();
      return { type: 'next' };
    }
  }
  class NextRequest {
    nextUrl: URL;
    cookies: { get: (name: string) => { value: string } | undefined };
    constructor(url: string, cookieVal?: string) {
      this.nextUrl = new URL(url);
      this.cookies = {
        get: (name: string) =>
          name === 'hopecard_token' && cookieVal ? { value: cookieVal } : undefined,
      };
    }
  }
  return { NextResponse, NextRequest };
});

import { middleware } from '../middleware';
import { NextRequest } from 'next/server';

describe('middleware', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockNext.mockClear();
  });

  it('allows request through when persona matches URL prefix', () => {
    const token = makeToken({ persona: 'admin', system: 'hopecard' });
    const req = new NextRequest('http://localhost/hope-card/admin/dashboard', token);
    middleware(req);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('redirects to login when no token present', () => {
    const req = new NextRequest('http://localhost/hope-card/donor/dashboard');
    middleware(req);
    expect(mockRedirect).toHaveBeenCalledWith('/hope-card/donor/login');
  });

  it('redirects to correct persona dashboard when persona is wrong', () => {
    const token = makeToken({ persona: 'donor', system: 'hopecard' });
    const req = new NextRequest('http://localhost/hope-card/admin/dashboard', token);
    middleware(req);
    expect(mockRedirect).toHaveBeenCalledWith('/hope-card/donor/dashboard');
  });

  it('allows beneficiary through on beneficiary route', () => {
    const token = makeToken({ persona: 'beneficiary', system: 'hopecard' });
    const req = new NextRequest('http://localhost/hope-card/beneficiary/profile', token);
    middleware(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows cm through on cm route', () => {
    const token = makeToken({ persona: 'cm', system: 'hopecard' });
    const req = new NextRequest('http://localhost/hope-card/cm/campaigns', token);
    middleware(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows request through on /login paths without a token', () => {
    const req = new NextRequest('http://localhost/hope-card/admin/login');
    middleware(req);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('allows request through for unknown persona prefix', () => {
    const req = new NextRequest('http://localhost/hope-card/unknown/page');
    middleware(req);
    expect(mockNext).toHaveBeenCalled();
  });

  it('redirects to login when token payload is malformed', () => {
    const req = new NextRequest('http://localhost/hope-card/donor/dashboard', 'not.a.jwt');
    middleware(req);
    expect(mockRedirect).toHaveBeenCalledWith('/hope-card/donor/login');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (middleware.ts does not exist yet)**

```bash
cd "C:/Users/arjel/Downloads/TriniThrive_Hopecard/Frontend/trini-thrive-fe/hope-card" && npx jest middleware --no-coverage
```

Expected: fail — `Cannot find module '../middleware'`.

- [ ] **Step 3: Create `Frontend/trini-thrive-fe/hope-card/middleware.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';

const PERSONA_PREFIXES: Record<string, string> = {
  admin: 'admin',
  donor: 'donor',
  beneficiary: 'beneficiary',
  cm: 'cm',
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const match = pathname.match(/^\/hope-card\/([^/]+)/);
  if (!match) return NextResponse.next();

  const urlSlug = match[1];
  const expectedPersona = PERSONA_PREFIXES[urlSlug];
  if (!expectedPersona) return NextResponse.next();

  if (pathname.includes('/login')) return NextResponse.next();

  const token = request.cookies.get('hopecard_token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL(`/hope-card/${urlSlug}/login`, request.nextUrl));
  }

  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.persona !== 'string') {
    return NextResponse.redirect(new URL(`/hope-card/${urlSlug}/login`, request.nextUrl));
  }

  if (payload.persona !== expectedPersona) {
    return NextResponse.redirect(new URL(`/hope-card/${payload.persona}/dashboard`, request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/hope-card/:path*'],
};
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd "C:/Users/arjel/Downloads/TriniThrive_Hopecard/Frontend/trini-thrive-fe/hope-card" && npx jest middleware --no-coverage
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit (from the backend repo root, referencing both paths)**

```bash
git add "C:/Users/arjel/Downloads/TriniThrive_Hopecard/Frontend/trini-thrive-fe/hope-card/middleware.ts" "C:/Users/arjel/Downloads/TriniThrive_Hopecard/Frontend/trini-thrive-fe/hope-card/tests/middleware.test.ts" 2>/dev/null || true
```

Note: The frontend is a separate directory — commit from within the frontend repo if it has its own git:

```bash
cd "C:/Users/arjel/Downloads/TriniThrive_Hopecard/Frontend/trini-thrive-fe/hope-card"
git add middleware.ts tests/middleware.test.ts
git commit -m "feat(security): add persona-to-URL middleware — redirects cross-persona navigation before page renders"
```

---

## Final Verification

- [ ] **Run all backend persona service tests**

```bash
npx jest --selectProjects api hopecard-admin-service hopecard-beneficiary-service hopecard-campaign-manager-service hopecard-donor-service --no-coverage
```

Expected: all pass.

- [ ] **Run frontend middleware tests**

```bash
cd "C:/Users/arjel/Downloads/TriniThrive_Hopecard/Frontend/trini-thrive-fe/hope-card" && npx jest middleware --no-coverage
```

Expected: 8 pass.
