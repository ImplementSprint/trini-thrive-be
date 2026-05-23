# HopeCard Services — Database Connection Map

> Auto-generated from full codebase scan of all hopecard microservices.
> Last updated: 2026-05-23

---

## Overview

All services use the **Supabase SDK directly** — no TypeORM entities or ORM repositories are used anywhere. Database interaction is done via `supabase.from('table_name').select/insert/update/delete()` or a `supabaseRequest()` helper wrapper.

---

## Database Tables Reference

| Table | Written By | Read By |
|-------|-----------|---------|
| `beneficiary_profiles` | beneficiary-auth, admin-beneficiaries | admin-approvals, admin-dashboard, beneficiary-campaigns, beneficiary-withdrawals, beneficiary-notifications, campaign-manager-auth, campaign-manager-campaigns, donor-global-stats |
| `digital_donor_profiles` | donor-auth | admin-approvals, admin-dashboard, campaign-manager-reporting, donor-profile |
| `campaign_manager_profiles` | (registration, not mapped here) | admin-approvals, campaign-manager-auth, campaign-manager-reporting |
| `otp_sessions` | admin-auth, beneficiary-auth, donor-auth | admin-auth, beneficiary-auth, donor-auth |
| `hc_campaigns` | campaign-manager-campaigns | admin-beneficiaries (campaigns), admin-dashboard, beneficiary-campaigns, donor-campaigns, campaign-manager-reporting, donor-profile |
| `campaign_beneficiaries` | campaign-manager-campaigns, beneficiary-campaigns | admin-beneficiaries, beneficiary-campaigns |
| `campaign_invitations` | (external/admin side) | beneficiary-campaigns, beneficiary-notifications |
| `hopecard_purchases` | admin-approvals (manual), donor-purchases | admin-dashboard, campaign-manager-reporting, donor-global-stats, donor-profile |
| `hopecards` | (external) | campaign-manager-reporting, donor-profile |
| `activity_logs` | admin-activity | admin-activity |
| `beneficiary_identity_documents` | beneficiary-identity-documents | admin-approvals |
| `beneficiary_bank_accounts` | beneficiary-bank-accounts | admin-approvals |
| `beneficiary_transactions` | (external) | beneficiary-withdrawals, beneficiary-notifications |
| `beneficiary_withdrawals` | beneficiary-withdrawals | beneficiary-withdrawals |
| `beneficiary_banking_activity` | beneficiary-bank-accounts, beneficiary-withdrawals | — |
| `carts` | donor-cart | donor-purchases |
| `cart_items` | donor-cart | donor-cart, donor-purchases |
| `hc_donor_notifications` | donor-notifications | donor-notifications |

### Storage Buckets

| Bucket | Written By | Read By |
|--------|-----------|---------|
| `beneficiary-documents` | beneficiary-identity-documents | beneficiary-identity-documents (signed URL) |
| `campaigns` | campaign-manager-campaigns | donor-campaigns, campaign-manager-reporting |
| `profile-photos` | donor-profile | donor-profile |

---

## Service-by-Service Breakdown

---

### HOPECARD-ADMIN-SERVICE

---

#### `analytics/activity.service.ts`

**Table:** `activity_logs`

| Field Written | Source |
|--------------|--------|
| `admin_id` | request context |
| `admin_email` | request context |
| `action` | caller parameter |
| `description` | caller parameter |
| `resource_type` | caller parameter |
| `resource_id` | caller parameter |
| `changes` | caller parameter |
| `ip_address` | HTTP request headers |
| `user_agent` | HTTP request headers |
| `created_at` | timestamp at insert time |

**Fields Read:** all `activity_logs` fields with pagination, filtered by `admin_id`, `action`, `resource_type`, date range.

**Called By:** all other admin services via `ActivityLogger` for audit logging.

---

#### `analytics/dashboard.service.ts`

**Tables Read (read-only):**

| Table | Fields | Purpose |
|-------|--------|---------|
| `beneficiary_profiles` | `status` (count where `status='approved'`) | total approved beneficiaries |
| `beneficiary_profiles` | `status` (count where `status='pending'`) | pending beneficiary approvals |
| `digital_donor_profiles` | `status` (count where `status='pending'`) | pending donor approvals |
| `campaign_manager_profiles` | `status` (count where `status='pending'`) | pending manager approvals |
| `hopecard_purchases` | `amount_paid` (sum) | total funds raised |
| `hc_campaigns` | `status` (count where `status='active'`) | active campaigns |

**Data Written:** None.

**Called By:** admin dashboard controller.

> **Note:** Falls back to mock/hardcoded data on query error — dashboard will silently show incorrect numbers if DB is unreachable.

---

#### `auth/auth.service.ts`

**Tables:** `otp_sessions` + Supabase Auth (`auth.users`)

| Field Written | Table | Source |
|--------------|-------|--------|
| `email` | `otp_sessions` | login request |
| `otp` | `otp_sessions` | randomly generated |
| `expires_at_ms` | `otp_sessions` | now + 5min |
| `created_at_ms` | `otp_sessions` | timestamp |
| `used` | `otp_sessions` | `false` on insert, `true` on verify |

**Fields Read:** `otp_sessions` (id, otp, used, expires_at_ms), Supabase auth user metadata.

**Operations:** `signInWithPassword`, insert OTP, verify OTP (mark used), `auth.admin.updateUserById` (password reset).

**Called By:** admin auth controller.

---

#### `approvals/beneficiary-approvals.service.ts`

**Tables:** `beneficiary_profiles`, `beneficiary_identity_documents`, `beneficiary_bank_accounts`, `campaign_beneficiaries`, `hopecard_purchases`, `activity_logs`

| Field Written | Table | Trigger |
|--------------|-------|---------|
| `status` | `beneficiary_profiles` | approve/reject action |
| `updated_at` | `beneficiary_profiles` | approve/reject action |
| `reviewed_by` | `beneficiary_profiles` | approve/reject action |
| `reviewed_at` | `beneficiary_profiles` | approve/reject action |
| `rejection_reason` | `beneficiary_profiles` | reject action only |
| `is_active` | `beneficiary_bank_accounts` | approval sets active |
| `amount_paid` | `hopecard_purchases` | manual donation record |
| `campaign` | `hopecard_purchases` | manual donation record |
| `notes` | `hopecard_purchases` | manual donation record |
| `processed_by` | `hopecard_purchases` | admin user id |
| `processed_at` | `hopecard_purchases` | timestamp |
| `status` | `hopecard_purchases` | `'paid'` |

**Fields Read:** `first_name`, `last_name`, `email` (joined from auth.users), `status`, `auth_user_id` from `beneficiary_profiles`. Also reads identity documents and bank accounts for display.

**Events Emitted:** beneficiary approved/rejected (to Kafka via ProcedureEventService).

**Called By:** admin approvals controller.

---

#### `approvals/campaign-manager-approvals.service.ts`

**Table:** `campaign_manager_profiles`

| Field Written | Trigger |
|--------------|---------|
| `status` | approve/reject action |
| `updated_at` | approve/reject action |
| `rejection_reason` | reject action only |

**Fields Read:** `id`, `name`, `email` (joined from auth.users), `phone`, `organization_name`, `status`, `auth_user_id`.

**Events Emitted:** campaign manager approved/rejected.

**Called By:** admin approvals controller.

---

#### `approvals/digital-donor-approvals.service.ts`

**Table:** `digital_donor_profiles`

| Field Written | Trigger |
|--------------|---------|
| `status` | approve/reject action |
| `updated_at` | approve/reject action |
| `rejection_reason` | reject action only |

**Fields Read:** `id`, `name`, `email`, `phone`, `status`, `auth_user_id`.

**Events Emitted:** donor approved/rejected.

**Called By:** admin approvals controller.

---

#### `beneficiary-management/beneficiaries.service.ts`

**Tables:** `beneficiary_profiles`, `campaign_beneficiaries`, `hc_campaigns`, `campaign_manager_profiles`

| Field Written | Table | Trigger |
|--------------|-------|---------|
| all profile fields | `beneficiary_profiles` | create/update |
| `updated_at` | `beneficiary_profiles` | update |

**Fields Read:** all `beneficiary_profiles` fields, campaign details, manager names (for joined views).

**Search:** ilike on `first_name`, `last_name`, `email`.

**Events Emitted:** beneficiary created, updated, deleted.

**Called By:** admin beneficiary management controller.

---

#### `beneficiary-management/campaigns.service.ts`

**Tables:** `hc_campaigns`, `campaign_manager_profiles` (read-only)

**Fields Read:** `id`, `title`, `description`, `target_amount`, `collected_amount`, `status`, `created_at`, `created_by`. Resolves manager name via `created_by → auth_user_id`.

**Data Written:** None.

**Called By:** admin campaigns controller.

---

### HOPECARD-BENEFICIARY-SERVICE

---

#### `auth/auth.service.ts`

**Tables:** `beneficiary_profiles`, `otp_sessions`, Supabase Auth

| Field Written | Table |
|--------------|-------|
| `email`, `otp`, `expires_at_ms`, `created_at_ms`, `used` | `otp_sessions` |

**Fields Read:** `beneficiary_profiles.id`, `auth_user_id`, `email`.

**Events Emitted:** beneficiary login.

---

#### `bank-accounts/bank-accounts.service.ts`

**Tables:** `beneficiary_bank_accounts`, `beneficiary_banking_activity`, `beneficiary_profiles`

| Field Written | Table | Trigger |
|--------------|-------|---------|
| `bank_name` | `beneficiary_bank_accounts` | add account |
| `account_holder_name` | `beneficiary_bank_accounts` | add account |
| `account_number` | `beneficiary_bank_accounts` | add account |
| `is_primary` | `beneficiary_bank_accounts` | add / update |
| `is_active` | `beneficiary_bank_accounts` | soft-delete sets `false` |
| `event_type` | `beneficiary_banking_activity` | `'account_added'` |
| `details` | `beneficiary_banking_activity` | event metadata |

**Fields Read:** `id`, `bank_name`, `account_holder_name`, `account_number`, `is_primary`, `status` filtered by `is_active=true`, `status='approved'`.

**Events Emitted:** bank account added/updated/removed.

---

#### `beneficiary-health/health.service.ts`

**Database:** NONE.

**`getHealth()`** — returns a hardcoded health status object. No database query is made.

> **EMPTY FUNCTIONALITY** — this service has no database connection and simply echoes a static response.

---

#### `campaigns/campaigns.service.ts`

**Tables:** `beneficiary_profiles`, `campaign_beneficiaries`, `hc_campaigns`, `campaign_invitations`

| Field Written | Table | Trigger |
|--------------|-------|---------|
| `campaign_id` | `campaign_beneficiaries` | beneficiary joins campaign |
| `beneficiary_profile_id` | `campaign_beneficiaries` | beneficiary joins campaign |
| `status` | `campaign_invitations` | accept/decline invitation |
| `responded_at` | `campaign_invitations` | accept/decline invitation |

**Fields Read:** campaign details (title, description, category, status, target_amount, collected_amount), invitation status.

**Events Emitted:** invitation accepted/declined.

---

#### `identity-documents/identity-documents.service.ts`

**Table:** `beneficiary_identity_documents`
**Storage:** `beneficiary-documents` bucket

| Field Written | Table/Storage | Trigger |
|--------------|--------------|---------|
| `document_key` | `beneficiary_identity_documents` | upload |
| `document_url` | `beneficiary_identity_documents` | upload (public URL from storage) |
| `label` | `beneficiary_identity_documents` | upload |
| `status` | `beneficiary_identity_documents` | `'pending'` on insert |
| file binary | `beneficiary-documents` bucket | upload |

**Fields Read:** `id`, `document_key`, `document_url`, `label`, `status`, `beneficiary_profile_id`.

**Events Emitted:** document uploaded, deleted.

---

#### `notifications/notifications.service.ts`

**Tables Read (read-only):**

| Table | Fields | Purpose |
|-------|--------|---------|
| `beneficiary_profiles` | `id`, `auth_user_id` | identify beneficiary |
| `campaign_invitations` | `status`, campaign details | pending invitations |
| `beneficiary_transactions` | `amount`, `notes` | approved transactions |

**Data Written:** None — aggregates and returns notification list from multiple tables.

---

#### `withdrawals/withdrawals.service.ts`

**Tables:** `beneficiary_profiles`, `beneficiaries`, `beneficiary_transactions`, `beneficiary_withdrawals`, `beneficiary_banking_activity`

| Field Written | Table | Trigger |
|--------------|-------|---------|
| `beneficiary_id` | `beneficiary_withdrawals` | withdrawal request |
| `amount` | `beneficiary_withdrawals` | withdrawal request |
| `status` | `beneficiary_withdrawals` | `'pending'` |
| `reference_number` | `beneficiary_withdrawals` | withdrawal request |
| `notes` | `beneficiary_withdrawals` | withdrawal request |
| `bank_account_id` | `beneficiary_withdrawals` | withdrawal request |
| `event_type` | `beneficiary_banking_activity` | `'withdrawal_requested'` |
| `details` | `beneficiary_banking_activity` | event metadata |

**Fields Read:** `beneficiary_transactions.amount` (sum for balance), `beneficiary_withdrawals.amount` (sum for deductions), `created_at`.

**Events Emitted:** withdrawal requested.

---

### HOPECARD-CAMPAIGN-MANAGER-SERVICE

---

#### `auth/auth.service.ts`

**Tables:** `campaign_manager_profiles`, `beneficiary_profiles` (read-only)

**Fields Read:** `campaign_manager_profiles.id`, `auth_user_id`; `beneficiary_profiles` (all fields, optional filter by status).

**Data Written:** None.

**Events Emitted:** campaign manager login.

---

#### `campaigns/campaigns.service.ts`

**Tables:** `hc_campaigns`, `campaign_beneficiaries`, `beneficiary_profiles`

| Field Written | Table | Source |
|--------------|-------|--------|
| `title` | `hc_campaigns` | create-campaign DTO |
| `category` | `hc_campaigns` | create-campaign DTO |
| `description` | `hc_campaigns` | create-campaign DTO |
| `target_amount` | `hc_campaigns` | create-campaign DTO |
| `end_date` | `hc_campaigns` | create-campaign DTO |
| `cover_image_key` | `hc_campaigns` | uploaded file key |
| `created_by` | `hc_campaigns` | manager's `auth_user_id` |
| `start_date` | `hc_campaigns` | create-campaign DTO |
| `status` | `hc_campaigns` | `'draft'` on create |
| `campaign_id` | `campaign_beneficiaries` | batch insert |
| `beneficiary_profile_id` | `campaign_beneficiaries` | batch insert from DTO array |

**Fields Read:** `title`, `target_amount`, `status`, `collected_amount`, `donor_count`, `end_date`, beneficiary `email`, `first_name`, `last_name` (for notification emails).

**Events Emitted:** campaign created (to Kafka). Also sends HTTP request to notification service.

---

#### `campaigns/entities/campaign.entity.ts`

> **EMPTY FUNCTIONALITY** — this file contains only a placeholder export (`export class Campaign {}`). No fields, no decorators, no database mapping. It is unused.

---

#### `reporting/reporting.service.ts`

**Tables Read (read-only):**

| Table | Fields | Purpose |
|-------|--------|---------|
| `campaign_manager_profiles` | `first_name`, `last_name` | display name |
| `hc_campaigns` | `id`, `title`, `status`, `collected_amount`, `target_amount`, `end_date`, `cover_image_key`, `created_at` | campaign list |
| `hopecards` | campaign join | link purchases to campaigns |
| `hopecard_purchases` | `amount_paid`, `purchased_at`, `buyer_auth_id`, `hopecard_id` where `status='paid'` | fund totals / activity |
| `digital_donor_profiles` | `first_name`, `last_name` | donor display names |

**Data Written:** None — reporting/analytics only.

---

### HOPECARD-DONOR-SERVICE

---

#### `auth/auth.service.ts`

**Tables:** `digital_donor_profiles`, `otp_sessions`, Supabase Auth

| Field Written | Table | Source |
|--------------|-------|--------|
| `auth_user_id` | `digital_donor_profiles` | Supabase created user id |
| `email` | `digital_donor_profiles` | registration DTO |
| `first_name` | `digital_donor_profiles` | registration DTO |
| `last_name` | `digital_donor_profiles` | registration DTO |
| `phone` | `digital_donor_profiles` | registration DTO |
| `address` | `digital_donor_profiles` | registration DTO |
| `id_verification_key` | `digital_donor_profiles` | uploaded file key |
| `status` | `digital_donor_profiles` | `'pending'` on create |
| `created_at` | `digital_donor_profiles` | timestamp |
| `updated_at` | `digital_donor_profiles` | timestamp |
| `email`, `otp`, `expires_at_ms`, `created_at_ms`, `used` | `otp_sessions` | OTP flow |

**Fields Read:** `digital_donor_profiles.status`, `email`, `auth_user_id`.

**Events Emitted:** donor registered, donor login, Google auth.

---

#### `campaigns/campaigns.service.ts`

**Table:** `hc_campaigns` (read-only)

**Fields Read:** `id`, `title`, `description`, `category`, `target_amount`, `collected_amount`, `cover_image_key`, `status`, `end_date`. Filtered by `status='active'`, optional category filter and title search.

**Data Written:** None.

---

#### `cart/cart.service.ts`

**Tables:** `carts`, `cart_items`, `hc_campaigns`

| Field Written | Table | Source |
|--------------|-------|--------|
| `auth_user_id` | `carts` | donor auth id |
| `status` | `carts` | `'active'` |
| `cart_id` | `cart_items` | active cart id |
| `campaign_id` | `cart_items` | add-to-cart DTO |
| `face_value` | `cart_items` | add-to-cart DTO |
| `quantity` | `cart_items` | add-to-cart DTO |

**Fields Read:** cart id, items (id, campaign_id, face_value, quantity), campaign details (title, category, cover_image_key) via join.

**Events Emitted:** item added, updated, removed.

---

#### `global-stats/global-stats.service.ts`

**Tables Read (read-only):**

| Table | Fields | Purpose |
|-------|--------|---------|
| `hopecard_purchases` | `amount_paid` (sum) where `status='paid'` | total funds raised |
| `beneficiary_profiles` | count | total beneficiaries |

**Derived Calculation:** `livesImpacted = fundsRaised / 200`

**Data Written:** None.

---

#### `notifications/notifications.service.ts`

**Table:** `hc_donor_notifications`

| Field Written | Source |
|--------------|--------|
| `donor_auth_id` | donor auth id |
| `type` | notification type string |
| `title` | notification title |
| `message` | notification body |
| `metadata` | JSON object |
| `is_read` | `false` on insert; `true` on mark-read |
| `created_at` | timestamp |

**Fields Read:** `id`, `type`, `title`, `message`, `metadata`, `is_read`, `created_at`, filtered by `donor_auth_id`.

**`broadcastNewCampaign()`** — fetches all donors, inserts one notification row per donor.

---

#### `profile/profile.service.ts`

**Tables:** `digital_donor_profiles`, `hopecard_purchases`, `hc_campaigns`, `hopecards`

| Field Written | Source |
|--------------|--------|
| `first_name` | update DTO |
| `last_name` | update DTO |
| `phone` | update DTO |
| `address` | update DTO |
| `barangay` | update DTO |
| `municipality` | update DTO |
| `province` | update DTO |
| `profile_photo_key` | uploaded file key |
| `updated_at` | timestamp |

**Fields Read:** all donor profile fields; `hopecard_purchases` with joined campaign titles for purchase history; total donations amount and count.

**Events Emitted:** profile updated.

---

#### `purchases/purchases.service.ts`

**Tables:** `carts`, `cart_items`, `hc_campaigns`, `hopecard_purchases`

| Field Written | Table | Source |
|--------------|-------|--------|
| `buyer_auth_id` | `hopecard_purchases` | donor auth id |
| `hopecard_id` | `hopecard_purchases` | cart item |
| `amount_paid` | `hopecard_purchases` | cart item face_value |
| `payment_method` | `hopecard_purchases` | payment provider |
| `payment_reference` | `hopecard_purchases` | payment provider reference |
| `status` | `hopecard_purchases` | `'paid'` |
| `purchased_at` | `hopecard_purchases` | timestamp |

> One `hopecard_purchases` row is inserted per item per quantity unit (batch insert).

**Post-Purchase Cleanup:** cart items are deleted; cart `status` reset to `'active'`.

**Events Emitted:** purchase completed.

---

### HOPECARD-NOTIFICATION-SERVICE

---

#### `notifications/notifications.service.ts`

**Database:** NONE.

**Operations:** Sends emails via SMTP (nodemailer). No database reads or writes at all.

> **EMPTY DATABASE FUNCTIONALITY** — this service has no database connection. It is purely an email relay. Any data persistence (e.g., sent email logs) does not happen here.

---

## Empty / Stub Functionality Summary

| File | Issue | Status |
|------|-------|--------|
| `apps/hopecard-campaign-manager-service/src/campaigns/entities/campaign.entity.ts` | Empty class — no fields, no decorators, never imported or used | **Fixed** — filled with `hc_campaigns` field definitions |
| `apps/hopecard-beneficiary-service/src/beneficiary-health/health.service.ts` | `getHealth()` returns hardcoded static value — no database query | **Fixed** — now pings Supabase and returns real `ok`/`degraded` status |
| `apps/hopecard-notification-service/src/notifications/notifications.service.ts` | Sends emails only — no database reads or writes, no sent-email logging | **By design** — email relay service; no DB connection is intentional |
| `apps/hopecard-admin-service/src/analytics/dashboard.service.ts` | Falls back to mock data silently on DB error — dashboard can display incorrect metrics without any error surfaced | **Fixed** — now throws `InternalServerErrorException` on failure instead of returning fake numbers |

---

## Cross-Service Data Flow

```
[Donor registers]
  → donor-auth writes digital_donor_profiles (status='pending')
  → event emitted to Kafka

[Admin approves donor]
  → admin-approvals updates digital_donor_profiles.status='approved'
  → event emitted

[Donor browses & adds to cart]
  → donor-campaigns reads hc_campaigns
  → donor-cart writes carts, cart_items

[Donor completes purchase]
  → donor-purchases reads carts/cart_items
  → donor-purchases calls payment provider (PayMongo)
  → donor-purchases writes hopecard_purchases (status='paid')
  → cart_items deleted, cart reset
  → event emitted

[Campaign manager creates campaign]
  → campaign-manager-campaigns writes hc_campaigns (status='draft')
  → writes campaign_beneficiaries (junction)
  → HTTP call to notification-service (sends email to beneficiaries)
  → event emitted to Kafka

[Beneficiary withdraws funds]
  → beneficiary-withdrawals reads beneficiary_transactions (approved sum)
  → beneficiary-withdrawals reads beneficiary_withdrawals (deducted sum)
  → beneficiary-withdrawals writes beneficiary_withdrawals (status='pending')
  → writes beneficiary_banking_activity (audit log)
  → event emitted
```
