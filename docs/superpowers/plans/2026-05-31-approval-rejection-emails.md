# Approval & Rejection Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send an email to any user (beneficiary, campaign manager, digital donor) when an admin approves or rejects their account.

**Architecture:** Two new functions (`sendApprovalEmail`, `sendRejectionEmail`) added to the shared `libs/common/src/email.ts` module, then called inline in each of the three approval services after a successful DB update. Email failures are non-fatal — they log a warning and do not affect the HTTP response.

**Tech Stack:** NestJS, nodemailer (already installed), Supabase, Jest + ts-jest

---

## File Map

| File | Change |
|---|---|
| `libs/common/src/email.ts` | Add `sendApprovalEmail` and `sendRejectionEmail` |
| `libs/common/src/email.spec.ts` | Create — unit tests for the two new functions |
| `apps/hopecard-admin-service/src/approvals/beneficiary-approvals.service.ts` | Call email in `approveBeneficiary` and `rejectBeneficiary` |
| `apps/hopecard-admin-service/src/approvals/campaign-manager-approvals.service.ts` | Add pre-fetch of name+email, call email in `approveCampaignManager` and `rejectCampaignManager` |
| `apps/hopecard-admin-service/src/approvals/digital-donor-approvals.service.ts` | Call email in `approveDonor` and `rejectDonor` |

---

## Task 1: Add `sendApprovalEmail` and `sendRejectionEmail` to `email.ts`

**Files:**
- Modify: `libs/common/src/email.ts`

- [ ] **Step 1: Add the two functions at the end of `libs/common/src/email.ts`**

Append after the closing brace of `sendOTPEmail`:

```ts
/**
 * Send account approval notification email
 */
export async function sendApprovalEmail(
  to: string,
  params: { name: string; role: string },
): Promise<boolean> {
  try {
    const { name, role } = params;
    const hasSmtp =
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD;

    if (!hasSmtp) {
      console.warn('[EMAIL] SMTP not configured. Logging approval email to console only.');
      console.log(`\n📧 APPROVAL EMAIL (Console Fallback)`);
      console.log(`To: ${to}`);
      console.log(`Name: ${name} | Role: ${role}`);
      console.log(`---\n`);
      return true;
    }

    const senderName = process.env.SMTP_FROM || 'Hopecard';
    const senderEmail = process.env.SMTP_USER;
    const fromAddress = `${senderName} <${senderEmail}>`;
    const transporter = createEmailTransporter();

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: 'Your HopeCard application has been approved',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2d6a4f;">HopeCard Application Approved</h2>
          <p>Hi ${esc(name)},</p>
          <p>Great news — your HopeCard <strong>${esc(role)}</strong> application has been <strong>approved</strong>.</p>
          <p>You can now log in and access your account using all HopeCard features available to your role.</p>
          <p style="color: #666; font-size: 14px;">
            If you have any questions, please contact our support team.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">© 2026 HopeCard. All rights reserved.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending approval email:', error);
    return false;
  }
}

/**
 * Send account rejection notification email
 */
export async function sendRejectionEmail(
  to: string,
  params: { name: string; role: string; reason?: string },
): Promise<boolean> {
  try {
    const { name, role, reason } = params;
    const hasSmtp =
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD;

    if (!hasSmtp) {
      console.warn('[EMAIL] SMTP not configured. Logging rejection email to console only.');
      console.log(`\n📧 REJECTION EMAIL (Console Fallback)`);
      console.log(`To: ${to}`);
      console.log(`Name: ${name} | Role: ${role} | Reason: ${reason ?? 'N/A'}`);
      console.log(`---\n`);
      return true;
    }

    const senderName = process.env.SMTP_FROM || 'Hopecard';
    const senderEmail = process.env.SMTP_USER;
    const fromAddress = `${senderName} <${senderEmail}>`;
    const transporter = createEmailTransporter();

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: 'Your HopeCard application was not approved',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #9b2c2c;">HopeCard Application Update</h2>
          <p>Hi ${esc(name)},</p>
          <p>We regret to inform you that your HopeCard <strong>${esc(role)}</strong> application has not been approved at this time.</p>
          ${
            reason
              ? `<table style="width:100%; border-collapse:collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 8px; background:#f8f8f8; font-weight:bold; width:140px;">Reason</td>
                <td style="padding: 8px; background:#fff;">${esc(reason)}</td>
              </tr>
            </table>`
              : ''
          }
          <p style="color: #666; font-size: 14px;">
            If you believe this decision was made in error or have questions, please contact our support team.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">© 2026 HopeCard. All rights reserved.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending rejection email:', error);
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/common/src/email.ts
git commit -m "feat(email): add sendApprovalEmail and sendRejectionEmail"
```

---

## Task 2: Unit tests for the two new email functions

**Files:**
- Create: `libs/common/src/email.spec.ts`

- [ ] **Step 1: Write the test file**

Create `libs/common/src/email.spec.ts`:

```ts
import { sendApprovalEmail, sendRejectionEmail } from './email';

const mockSendMail = jest.fn().mockResolvedValue({});
const mockCreateTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });

jest.mock('nodemailer', () => ({
  createTransport: (...args: any[]) => mockCreateTransport(...args),
}));

const SMTP_ENV = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'test@example.com',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM: 'HopeCard Test',
};

describe('sendApprovalEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, SMTP_ENV);
  });

  afterEach(() => {
    for (const key of Object.keys(SMTP_ENV)) {
      delete process.env[key];
    }
  });

  it('sends an approval email and returns true', async () => {
    const result = await sendApprovalEmail('user@example.com', {
      name: 'Juan dela Cruz',
      role: 'beneficiary',
    });

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.subject).toBe('Your HopeCard application has been approved');
    expect(call.html).toContain('Juan dela Cruz');
    expect(call.html).toContain('beneficiary');
  });

  it('returns true and logs to console when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendApprovalEmail('user@example.com', {
      name: 'Juan',
      role: 'beneficiary',
    });

    expect(result).toBe(true);
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SMTP not configured'));
    consoleSpy.mockRestore();
  });

  it('returns false when sendMail throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

    const result = await sendApprovalEmail('user@example.com', {
      name: 'Juan',
      role: 'beneficiary',
    });

    expect(result).toBe(false);
  });
});

describe('sendRejectionEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, SMTP_ENV);
  });

  afterEach(() => {
    for (const key of Object.keys(SMTP_ENV)) {
      delete process.env[key];
    }
  });

  it('sends a rejection email with reason and returns true', async () => {
    const result = await sendRejectionEmail('user@example.com', {
      name: 'Maria Santos',
      role: 'campaign manager',
      reason: 'Incomplete documents',
    });

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.subject).toBe('Your HopeCard application was not approved');
    expect(call.html).toContain('Maria Santos');
    expect(call.html).toContain('campaign manager');
    expect(call.html).toContain('Incomplete documents');
  });

  it('sends a rejection email without reason and returns true', async () => {
    const result = await sendRejectionEmail('user@example.com', {
      name: 'Maria Santos',
      role: 'digital donor',
    });

    expect(result).toBe(true);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).not.toContain('Reason');
  });

  it('returns true and logs to console when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendRejectionEmail('user@example.com', {
      name: 'Maria',
      role: 'beneficiary',
      reason: 'Fraud',
    });

    expect(result).toBe(true);
    expect(mockSendMail).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns false when sendMail throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

    const result = await sendRejectionEmail('user@example.com', {
      name: 'Maria',
      role: 'digital donor',
    });

    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect PASS**

```bash
npx jest --selectProjects api --testPathPattern="libs/common/src/email" --no-coverage
```

Expected output: `Tests: 8 passed, 8 total`

- [ ] **Step 3: Commit**

```bash
git add libs/common/src/email.spec.ts
git commit -m "test(email): unit tests for sendApprovalEmail and sendRejectionEmail"
```

---

## Task 3: Wire emails into `BeneficiaryApprovalsService`

**Files:**
- Modify: `apps/hopecard-admin-service/src/approvals/beneficiary-approvals.service.ts`

- [ ] **Step 1: Add import at the top of the file**

Find the existing imports block (currently: `import { Injectable } from '@nestjs/common';` etc.) and add:

```ts
import { sendApprovalEmail, sendRejectionEmail } from '@app/common/email';
```

- [ ] **Step 2: Call `sendApprovalEmail` in `approveBeneficiary`**

In `approveBeneficiary`, after the `this.events.emit(...)` call and before `console.log('✅ Beneficiary approved...')`, add:

```ts
      try {
        await sendApprovalEmail(data?.[0]?.email, {
          name: `${beneficiaryData?.first_name ?? ''} ${beneficiaryData?.last_name ?? ''}`.trim(),
          role: 'beneficiary',
        });
      } catch (emailError) {
        console.warn('Failed to send approval email to beneficiary:', emailError);
      }
```

- [ ] **Step 3: Call `sendRejectionEmail` in `rejectBeneficiary`**

In `rejectBeneficiary`, after the `this.events.emit(...)` call and before `console.log('✅ Beneficiary rejected...')`, add:

```ts
      try {
        await sendRejectionEmail(data?.[0]?.email, {
          name: `${beneficiaryData?.first_name ?? ''} ${beneficiaryData?.last_name ?? ''}`.trim(),
          role: 'beneficiary',
          reason: reason,
        });
      } catch (emailError) {
        console.warn('Failed to send rejection email to beneficiary:', emailError);
      }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/hopecard-admin-service/src/approvals/beneficiary-approvals.service.ts
git commit -m "feat(approvals): send approval/rejection email to beneficiary"
```

---

## Task 4: Wire emails into `CampaignManagerApprovalsService`

**Files:**
- Modify: `apps/hopecard-admin-service/src/approvals/campaign-manager-approvals.service.ts`

- [ ] **Step 1: Add import at the top of the file**

```ts
import { sendApprovalEmail, sendRejectionEmail } from '@app/common/email';
```

- [ ] **Step 2: Add pre-fetch of name and email in `approveCampaignManager`**

At the start of the `try` block in `approveCampaignManager`, before the `supabase.from('campaign_manager_profiles').update(...)` call, add:

```ts
      const { data: managerData } = await supabase
        .from('campaign_manager_profiles')
        .select('first_name, last_name, email')
        .eq('id', campaignManagerId)
        .single();
```

- [ ] **Step 3: Call `sendApprovalEmail` in `approveCampaignManager`**

After the `this.events.emit(...)` call and before `console.log('✅ Campaign manager approved...')`, add:

```ts
      try {
        const managerName = managerData
          ? `${managerData.first_name ?? ''} ${managerData.last_name ?? ''}`.trim()
          : '';
        await sendApprovalEmail(managerData?.email ?? data?.[0]?.email, {
          name: managerName || 'Campaign Manager',
          role: 'campaign manager',
        });
      } catch (emailError) {
        console.warn('Failed to send approval email to campaign manager:', emailError);
      }
```

- [ ] **Step 4: Add pre-fetch of name and email in `rejectCampaignManager`**

At the start of the `try` block in `rejectCampaignManager`, before the `supabase.from('campaign_manager_profiles').update(...)` call, add:

```ts
      const { data: managerData } = await supabase
        .from('campaign_manager_profiles')
        .select('first_name, last_name, email')
        .eq('id', campaignManagerId)
        .single();
```

- [ ] **Step 5: Call `sendRejectionEmail` in `rejectCampaignManager`**

After the `this.events.emit(...)` call and before `console.log('✅ Campaign manager rejected...')`, add:

```ts
      try {
        const managerName = managerData
          ? `${managerData.first_name ?? ''} ${managerData.last_name ?? ''}`.trim()
          : '';
        await sendRejectionEmail(managerData?.email ?? data?.[0]?.email, {
          name: managerName || 'Campaign Manager',
          role: 'campaign manager',
          reason: reason,
        });
      } catch (emailError) {
        console.warn('Failed to send rejection email to campaign manager:', emailError);
      }
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/hopecard-admin-service/src/approvals/campaign-manager-approvals.service.ts
git commit -m "feat(approvals): send approval/rejection email to campaign manager"
```

---

## Task 5: Wire emails into `DigitalDonorApprovalsService`

**Files:**
- Modify: `apps/hopecard-admin-service/src/approvals/digital-donor-approvals.service.ts`

- [ ] **Step 1: Add import at the top of the file**

```ts
import { sendApprovalEmail, sendRejectionEmail } from '@app/common/email';
```

- [ ] **Step 2: Call `sendApprovalEmail` in `approveDonor`**

In `approveDonor`, after the `this.events.emit(...)` call and before `console.log('✅ Digital donor approved...')`, add:

```ts
      try {
        await sendApprovalEmail(existingDonor?.email, {
          name: existingDonor?.name ?? 'Donor',
          role: 'digital donor',
        });
      } catch (emailError) {
        console.warn('Failed to send approval email to digital donor:', emailError);
      }
```

- [ ] **Step 3: Call `sendRejectionEmail` in `rejectDonor`**

In `rejectDonor`, after the `this.events.emit(...)` call and before `console.log('✅ Digital donor rejected...')`, add:

```ts
      try {
        await sendRejectionEmail(existingDonor?.email, {
          name: existingDonor?.name ?? 'Donor',
          role: 'digital donor',
          reason: reason,
        });
      } catch (emailError) {
        console.warn('Failed to send rejection email to digital donor:', emailError);
      }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/hopecard-admin-service/src/approvals/digital-donor-approvals.service.ts
git commit -m "feat(approvals): send approval/rejection email to digital donor"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run the full hopecard-admin-service test suite**

```bash
npx jest --selectProjects hopecard-admin-service --no-coverage
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck across the whole repo**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test (if SMTP is configured)**

Approve or reject a beneficiary via the admin API and confirm the email arrives. If SMTP is not configured, confirm the console fallback logs appear with correct name, role, and (for rejection) reason.
