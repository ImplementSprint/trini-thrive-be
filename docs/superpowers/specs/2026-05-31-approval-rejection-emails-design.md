---
title: Approval & Rejection Email Notifications
date: 2026-05-31
status: approved
---

## Overview

When an admin approves or rejects a user of any role (beneficiary, campaign manager, digital donor), send that user an email notifying them of the decision.

## Approach

Option A — inline fire-and-forget, consistent with existing `sendAccountStatusEmail` usage in the codebase. Email failure does not fail the approval/rejection operation.

## New functions in `libs/common/src/email.ts`

```ts
sendApprovalEmail(to: string, params: { name: string; role: string }): Promise<boolean>
sendRejectionEmail(to: string, params: { name: string; role: string; reason?: string }): Promise<boolean>
```

- Same SMTP transporter and `hasSmtp` console-fallback guard as existing email functions.
- Green-toned HTML for approval, red-toned for rejection.
- Both swallow errors and return `false` on failure.

## Call sites

| Service | Method(s) | Name source | Email source | Pre-fetch needed? |
|---|---|---|---|---|
| `BeneficiaryApprovalsService` | `approveBeneficiary`, `rejectBeneficiary` | `beneficiaryData.first_name + last_name` | `data?.[0].email` | No — already fetched |
| `CampaignManagerApprovalsService` | `approveCampaignManager`, `rejectCampaignManager` | `first_name`, `last_name` | `email` | Yes — add `select('first_name, last_name, email')` before update |
| `DigitalDonorApprovalsService` | `approveDonor`, `rejectDonor` | `existingDonor.name` | `existingDonor.email` | No — already fetched |

Each call site wraps the email send in `try/catch` with `console.warn` on failure, matching the pattern used for activity logging in `approveBeneficiary`.

## Error handling

Email failures are non-fatal. They log a warning but do not affect the HTTP response or the DB state.

## No schema changes

No new tables, columns, or migrations required.
