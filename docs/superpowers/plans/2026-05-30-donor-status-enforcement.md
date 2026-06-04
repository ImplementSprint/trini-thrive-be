# Donor Account Status Enforcement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suspended donors see a "Suspended" badge and cannot add to cart or top up their wallet; banned donors are force-logged out on load and blocked from logging in with a clear ban message.

**Architecture:** A new `DonorStatusContext` provider sits above `CartProvider` in the donor layout — it fetches the profile status once on mount, auto-logs out banned users, and exposes `isSuspended`/`isBanned` flags consumed by `CartContext` and the wallet page. The backend `login()` method blocks banned accounts and allows suspended accounts through. The login page handles both the API ban response and the `?banned=1` redirect from auto-logout.

**Tech Stack:** Next.js 14 App Router, React context, NestJS, Supabase JS client, TypeScript

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `apps/hopecard-donor-service/src/auth/auth.service.ts` | Block banned users at login; allow suspended users |
| Modify | `src/donor-hooks/useProfile.ts` | Add `suspended`/`banned` to status type; add `status_reason`/`status_expires_at` |
| **Create** | `src/donor-contexts/DonorStatusContext.tsx` | Provider: fetch status, auto-logout banned, expose flags |
| Modify | `src/app/(donor)/layout.tsx` | Wrap `CartProvider` with `DonorStatusProvider` |
| Modify | `src/donor-contexts/CartContext.tsx` | Throw in `addToCart`/`checkout`/`checkoutFromWallet` when suspended/banned |
| Modify | `src/app/(donor)/donor/profile/HopecardProfile.tsx` | Status badge cases for suspended/banned |
| Modify | `src/app/(donor)/donor/(auth)/login/page.tsx` | Handle `reason: 'banned'` from API + `?banned=1` redirect param |
| Modify | `src/app/(donor)/donor/wallet/page.tsx` | Disable top-up section when suspended |

> **Path roots:**
> - Backend: `C:\Users\arjel\Downloads\TriniThrive_Hopecard\Backend\trini-thrive-be\`
> - Frontend: `C:\Users\arjel\Downloads\TriniThrive_Hopecard\Frontend\trini-thrive-fe\hope-card\src\`

---

### Task 1: Backend — block banned logins, allow suspended logins

**Files:**
- Modify: `apps/hopecard-donor-service/src/auth/auth.service.ts` (lines 132–144)

- [ ] **Step 1: Update the profile select and status checks in `login()`**

Replace lines 132–144 with the following. The select gains `status_reason` and `status_expires_at`. A `banned` check is inserted before the existing pending check. The `approved` guard becomes `approved | suspended`.

```typescript
    const { data: profile, error: profileError } = await admin
      .from('digital_donor_profiles')
      .select('id, status, status_reason, status_expires_at')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();

    if (profileError) throw new InternalServerErrorException('Database error');
    if (!profile) throw new UnauthorizedException('No donor account found for this email');

    const status = (profile as any).status as string;
    const statusReason = (profile as any).status_reason as string | null;
    const statusExpiresAt = (profile as any).status_expires_at as string | null;

    if (status === 'banned') {
      throw new ForbiddenException({
        reason: 'banned',
        status_reason: statusReason,
        status_expires_at: statusExpiresAt,
      });
    }

    if (status !== 'approved' && status !== 'suspended') {
      throw new ForbiddenException({ reason: 'pending_approval', status });
    }
```

- [ ] **Step 2: Verify the file compiles**

Run from the backend root:
```bash
npx tsc --noEmit -p apps/hopecard-donor-service/tsconfig.app.json
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/hopecard-donor-service/src/auth/auth.service.ts
git commit -m "feat: block banned donors at login, allow suspended donors through"
```

---

### Task 2: Frontend — extend `UserProfile` type in `useProfile.ts`

**Files:**
- Modify: `src/donor-hooks/useProfile.ts` (lines 18–23)

- [ ] **Step 1: Update the `UserProfile` interface**

Replace the existing interface (lines 7–23) with:

```typescript
export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  barangay: string;
  municipality: string;
  province: string;
  profile_photo_url: string | null;
  profile_photo_key: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | 'banned';
  status_reason: string | null;
  status_expires_at: string | null;
  created_at: string;
  total_donations_amount: number;
  total_donations_count: number;
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd "C:\Users\arjel\Downloads\TriniThrive_Hopecard\Frontend\trini-thrive-fe\hope-card"
npx tsc --noEmit
```
Expected: no new errors (existing errors are pre-existing and unrelated).

- [ ] **Step 3: Commit**

```bash
git add src/donor-hooks/useProfile.ts
git commit -m "feat: extend UserProfile type with suspended/banned statuses and status fields"
```

---

### Task 3: Create `DonorStatusContext.tsx`

**Files:**
- Create: `src/donor-contexts/DonorStatusContext.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';

import React, {
  createContext, useContext, useEffect, useState, ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getDonorTokenPayload } from '@/donor-lib/supabase-client';

interface DonorStatusState {
  isSuspended: boolean;
  isBanned: boolean;
  statusReason: string | null;
  statusExpiresAt: string | null;
  isLoading: boolean;
}

const DonorStatusContext = createContext<DonorStatusState>({
  isSuspended: false,
  isBanned: false,
  statusReason: null,
  statusExpiresAt: null,
  isLoading: true,
});

export function DonorStatusProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<DonorStatusState>({
    isSuspended: false,
    isBanned: false,
    statusReason: null,
    statusExpiresAt: null,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      const { data: { session } } = await supabase.auth.getSession();
      let userId: string | null = null;
      let email: string | null = null;
      let token: string | null = null;

      if (session?.user) {
        userId = session.user.id;
        email = session.user.email ?? null;
        token = localStorage.getItem('donor_token') ?? session.access_token ?? null;
      } else {
        const payload = getDonorTokenPayload();
        if (payload?.sub) {
          userId = payload.sub;
          email = (payload as any).email ?? null;
          token = localStorage.getItem('donor_token') ?? null;
        }
      }

      if (!userId) {
        if (!cancelled) setState(s => ({ ...s, isLoading: false }));
        return;
      }

      try {
        const base = process.env.NEXT_PUBLIC_DONOR_BACKEND_URL ?? '';
        const res = await fetch(
          `${base}/api/v1/hopecard/donor/profile?authUserId=${userId}&email=${encodeURIComponent(email ?? '')}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!res.ok) {
          if (!cancelled) setState(s => ({ ...s, isLoading: false }));
          return;
        }

        const data = await res.json();
        const profile = data.profile;
        const status: string = profile?.status ?? '';
        const statusReason: string | null = profile?.status_reason ?? null;
        const statusExpiresAt: string | null = profile?.status_expires_at ?? null;

        if (status === 'banned') {
          await supabase.auth.signOut();
          localStorage.removeItem('donor_token');
          document.cookie = 'persona=; path=/; SameSite=Strict; Max-Age=0';
          const params = new URLSearchParams({ banned: '1' });
          if (statusReason) params.set('reason', statusReason);
          if (statusExpiresAt) params.set('expires', statusExpiresAt);
          router.push(`/donor/login?${params.toString()}`);
          return;
        }

        if (!cancelled) {
          setState({
            isSuspended: status === 'suspended',
            isBanned: false,
            statusReason,
            statusExpiresAt,
            isLoading: false,
          });
        }
      } catch {
        if (!cancelled) setState(s => ({ ...s, isLoading: false }));
      }
    }

    checkStatus();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <DonorStatusContext.Provider value={state}>
      {children}
    </DonorStatusContext.Provider>
  );
}

export function useDonorStatus(): DonorStatusState {
  return useContext(DonorStatusContext);
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add src/donor-contexts/DonorStatusContext.tsx
git commit -m "feat: add DonorStatusContext — auto-logout banned donors, expose suspension flags"
```

---

### Task 4: Wire `DonorStatusProvider` into the donor layout

**Files:**
- Modify: `src/app/(donor)/layout.tsx`

- [ ] **Step 1: Update the layout**

Replace the entire file content with:

```tsx
import type { Metadata } from "next";
import { CartProvider } from "@/donor-contexts/CartContext";
import { DonorStatusProvider } from "@/donor-contexts/DonorStatusContext";

export const metadata: Metadata = {
  title: "Hopecard",
  description: "Support meaningful causes and make an impact in different communities.",
  icons: {
    icon: '/donor/logo_h.png',
  },
};

export default function DonorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DonorStatusProvider>
      <CartProvider>
        {children}
      </CartProvider>
    </DonorStatusProvider>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(donor)/layout.tsx
git commit -m "feat: wrap donor layout with DonorStatusProvider above CartProvider"
```

---

### Task 5: Block cart actions when account is suspended or banned

**Files:**
- Modify: `src/donor-contexts/CartContext.tsx`

- [ ] **Step 1: Import `useDonorStatus` at the top of the file**

Add to the existing imports (after the existing `import` statements):

```tsx
import { useDonorStatus } from './DonorStatusContext';
```

- [ ] **Step 2: Read status inside `CartProvider` component body**

Inside the `CartProvider` function body, add this line directly after the existing `useState`/`useCallback` declarations (around line 83):

```tsx
  const { isSuspended, isBanned } = useDonorStatus();
```

- [ ] **Step 3: Guard `addToCart`**

In `addToCart` (currently line 163), add a suspension check as the very first check inside the function body, before the `if (!authUserId)` check:

```tsx
  const addToCart = useCallback(async (item: {
    campaign_id: string; title: string; price: number;
    imageSrc: string; imageAlt: string; category?: string;
  }) => {
    if (isSuspended || isBanned) throw new Error('Your account is suspended. Donations are currently disabled.');
    if (!authUserId) throw new Error('Please log in to manage your cart');
    // ... rest unchanged
```

- [ ] **Step 4: Guard `checkout`**

In `checkout` (currently line 221), add the same check after `if (!authUserId)`:

```tsx
  const checkout = useCallback(async (): Promise<string> => {
    if (!authUserId) throw new Error('Not authenticated');
    if (isSuspended || isBanned) throw new Error('Your account is suspended. Checkout is currently disabled.');
    if (cart.length === 0) throw new Error('Cart is empty');
    // ... rest unchanged
```

- [ ] **Step 5: Guard `checkoutFromWallet`**

In `checkoutFromWallet` (currently line 245), add the same check after `if (!authUserId)`:

```tsx
  const checkoutFromWallet = useCallback(async (): Promise<{...}> => {
    if (!authUserId) throw new Error('Not authenticated');
    if (isSuspended || isBanned) throw new Error('Your account is suspended. Wallet checkout is currently disabled.');
    if (cart.length === 0) throw new Error('Cart is empty');
    // ... rest unchanged
```

- [ ] **Step 6: Add `isSuspended` and `isBanned` to the `useCallback` dependency arrays**

Each of those three callbacks needs `isSuspended` and `isBanned` in its deps array. For example `addToCart`'s current deps are `[authUserId, accessToken, applyCartResponse]` — update to `[authUserId, accessToken, applyCartResponse, isSuspended, isBanned]`. Do the same for `checkout` and `checkoutFromWallet`.

- [ ] **Step 7: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/donor-contexts/CartContext.tsx
git commit -m "feat: block cart add/checkout when donor account is suspended or banned"
```

---

### Task 6: Update the profile status badge

**Files:**
- Modify: `src/app/(donor)/donor/profile/HopecardProfile.tsx` (lines 471–487)

- [ ] **Step 1: Replace the status badge span**

Locate this block (around lines 471–487):

```tsx
              <span
                style={{
                  padding: "0.25rem 0.75rem",
                  background: profile?.status === 'approved' ? `${colors.secondaryContainer}33` : `${colors.surfaceContainerHigh}`,
                  color: profile?.status === 'approved' ? colors.onSecondaryContainer : colors.onSurfaceVariant,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  borderRadius: "999px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                <BadgeCheck size={14} fill={profile?.status === 'approved' ? "currentColor" : "none"} />
                {profile?.status === 'approved' ? 'Verified Donor' : 'Pending Verification'}
              </span>
```

Replace with:

```tsx
              {(() => {
                const s = profile?.status;
                const badge = s === 'approved'
                  ? { bg: `${colors.secondaryContainer}33`, color: colors.onSecondaryContainer, label: 'Verified Donor', fill: 'currentColor' }
                  : s === 'suspended'
                  ? { bg: '#fff7ed', color: '#9a3412', label: 'Account Suspended', fill: 'none' }
                  : s === 'banned'
                  ? { bg: '#fef2f2', color: '#991b1b', label: 'Account Banned', fill: 'none' }
                  : { bg: colors.surfaceContainerHigh, color: colors.onSurfaceVariant, label: 'Pending Verification', fill: 'none' };
                return (
                  <span
                    style={{
                      padding: "0.25rem 0.75rem",
                      background: badge.bg,
                      color: badge.color,
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      borderRadius: "999px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontFamily: "Manrope, sans-serif",
                    }}
                  >
                    <BadgeCheck size={14} fill={badge.fill} />
                    {badge.label}
                  </span>
                );
              })()}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(donor)/donor/profile/HopecardProfile.tsx
git commit -m "feat: show Suspended/Banned badge on donor profile page"
```

---

### Task 7: Handle ban errors on the login page

**Files:**
- Modify: `src/app/(donor)/donor/(auth)/login/page.tsx`

- [ ] **Step 1: Add a helper to build the ban message**

Add this helper function outside the `LoginForm` component (place it just above the `function LoginForm()` declaration):

```tsx
function buildBanMessage(reason: string | null, expiresAt: string | null): string {
  const reasonPart = reason ? ` Reason: ${reason}` : '';
  if (expiresAt) {
    const date = new Date(expiresAt);
    const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return `Your account has been banned until ${dateStr} (${days} day${days !== 1 ? 's' : ''}).${reasonPart}`;
  }
  return `Your account has been permanently banned.${reasonPart}`;
}
```

- [ ] **Step 2: Show ban message from query params on mount**

Inside `LoginForm`, find the existing `useEffect` that clears the persona cookie (around line 22). Add a second `useEffect` directly after it:

```tsx
  useEffect(() => {
    if (searchParams.get('banned') === '1') {
      setErrorMessage(buildBanMessage(
        searchParams.get('reason'),
        searchParams.get('expires'),
      ));
    }
  }, [searchParams]);
```

- [ ] **Step 3: Handle `reason: 'banned'` in the API response**

Inside `handleLogin`, find the existing block that checks `data.reason === 'pending_approval'` (around line 53). Add a new check for `banned` **before** it:

```tsx
      if (!res.ok) {
        if (data.reason === 'banned') {
          setErrorMessage(buildBanMessage(data.status_reason ?? null, data.status_expires_at ?? null));
          return;
        }
        // Handle approval status case
        if (data.reason === 'pending_approval') {
          // ... existing code unchanged
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/(donor)/donor/(auth)/login/page.tsx
git commit -m "feat: show ban message on login for banned donors (API response + redirect params)"
```

---

### Task 8: Disable wallet top-up when suspended

**Files:**
- Modify: `src/app/(donor)/donor/wallet/page.tsx`

- [ ] **Step 1: Import `useDonorStatus`**

Add to the existing imports at the top of the file:

```tsx
import { useDonorStatus } from '@/donor-contexts/DonorStatusContext';
```

- [ ] **Step 2: Read suspension state inside the component**

Inside `WalletPage`, after the existing `useState` declarations (around line 40), add:

```tsx
  const { isSuspended, isBanned } = useDonorStatus();
  const isRestricted = isSuspended || isBanned;
```

- [ ] **Step 3: Block `handleTopUp` when restricted**

In `handleTopUp` (around line 90), add a guard as the very first check:

```tsx
  const handleTopUp = async () => {
    if (isRestricted) {
      setError('Top-ups are unavailable while your account is suspended.');
      return;
    }
    if (resolvedAmount < 50) {
    // ... rest unchanged
```

- [ ] **Step 4: Show a suspension notice and disable preset/input when restricted**

Find the JSX section that renders the preset amount buttons and the custom input. Wrap that entire section with a conditional notice. The section to find starts around the `PRESET_AMOUNTS.map(...)` call. Add just before the preset amount buttons grid:

```tsx
            {isRestricted && (
              <div style={{
                padding: '1rem',
                borderRadius: '0.75rem',
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                color: '#9a3412',
                fontSize: '0.875rem',
                fontFamily: 'Manrope, sans-serif',
                marginBottom: '1rem',
              }}>
                Top-ups are unavailable while your account is suspended.
              </div>
            )}
```

Then add `disabled={isRestricted}` and `style={{ opacity: isRestricted ? 0.5 : 1, pointerEvents: isRestricted ? 'none' : 'auto' }}` to the preset amount buttons and to the custom amount `<input>`.

Also add `disabled={loading || resolvedAmount <= 0 || isRestricted}` to the "Top Up Wallet" submit button.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/(donor)/donor/wallet/page.tsx
git commit -m "feat: disable wallet top-up for suspended/banned donors"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Suspended donors see "Account Suspended" badge — Task 6
- ✅ Suspended donors cannot add to cart — Task 5
- ✅ Suspended donors cannot top up wallet — Task 8
- ✅ Banned donors are force-logged out on load — Task 3 (`DonorStatusContext` auto-logout)
- ✅ Banned donors see ban message when logging in (API response) — Task 7
- ✅ Banned donors see ban message after redirect from auto-logout — Task 7
- ✅ Duration shown if temporary ban, "permanently" if no expiry — Tasks 1 & 7 (`buildBanMessage`)

**Type consistency:**
- `useDonorStatus()` returns `{ isSuspended, isBanned, statusReason, statusExpiresAt, isLoading }` — defined in Task 3, consumed in Tasks 4, 5, 8
- `UserProfile.status` union extended in Task 2 matches what `DonorStatusContext` reads from the same API endpoint
- `buildBanMessage(reason, expiresAt)` defined and called in Task 7 only

**No placeholders:** All code blocks are complete and directly usable.
