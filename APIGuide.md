# Hopecard API Guide

This guide covers all API endpoints across the Hopecard microservices architecture. The platform is divided into five services, each serving a specific persona.

---

## Architecture Overview

| Service | Base Path | Description |
|---|---|---|
| Admin Service | `/hopecard/admin` | Internal admin portal for managing the platform |
| Beneficiary Service | `/hopecard/beneficiary` | Portal for aid recipients |
| Donor Service | `/hopecard/donor` | Portal for individuals who purchase and donate hopecards |
| Campaign Manager Service | `/hopecard/cm` | Portal for campaign managers who run fundraising campaigns |
| Notification Service | `/hopecard/notification` | Internal service for sending notifications |

All services apply `CorrelationIdMiddleware` globally for distributed tracing.

---

## Authentication Notes

- **Admin**: OTP-based two-factor login (email/password → OTP verification).
- **Beneficiary / Donor / Campaign Manager**: Email and password with JWT. Password recovery uses OTP.
- **Donor only**: Google OAuth 2.0 is also supported.
- Protected routes use the `@RequirePersona(role, 'hopecard')` decorator. Passing an incorrect role returns a 403.

---

## 1. Admin Service — `/hopecard/admin`

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/admin/auth/login` | Log in with `email` and `password`. Returns a session token and triggers OTP delivery. |
| `POST` | `/hopecard/admin/auth/verify-otp` | Verify the OTP sent during login to complete two-factor authentication and receive a JWT. |
| `POST` | `/hopecard/admin/auth/send-otp` | Resend the OTP to the admin's registered contact. |
| `POST` | `/hopecard/admin/auth/change-password` | Change the authenticated admin's password. Requires a valid JWT. |
| `GET` | `/hopecard/admin/auth/verify-session` | Verify that the current JWT session is still valid. Returns session metadata. |
| `POST` | `/hopecard/admin/auth/logout` | Invalidate the current JWT session and log out. |

---

### Beneficiary Management

Requires `@RequirePersona('admin', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/admin/beneficiaries` | List all beneficiaries. Supports `page` and `limit` query parameters for pagination. |
| `GET` | `/hopecard/admin/beneficiaries/search` | Search beneficiaries by name or identifier. Query params: `q` (search term), `page`, `limit`. |
| `GET` | `/hopecard/admin/beneficiaries/status/:status` | Filter beneficiaries by approval status (e.g. `pending`, `approved`, `rejected`). Supports `page` and `limit`. |
| `GET` | `/hopecard/admin/beneficiaries/:id` | Retrieve full details for a specific beneficiary by their ID. |
| `POST` | `/hopecard/admin/beneficiaries` | Create a new beneficiary record. Returns `201 Created`. |
| `PUT` | `/hopecard/admin/beneficiaries/:id` | Update all fields of an existing beneficiary by ID. |
| `DELETE` | `/hopecard/admin/beneficiaries/:id` | Permanently delete a beneficiary record. Returns `204 No Content`. |

---

### Campaigns

Requires `@RequirePersona('admin', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/admin/campaigns` | List all campaigns across the platform. Supports `page` and `limit` query parameters. |

---

### Approvals — Beneficiaries

Requires `@RequirePersona('admin', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/admin/approvals/beneficiaries` | List all pending beneficiary approval requests. Supports `page` and `limit`. |
| `GET` | `/hopecard/admin/approvals/beneficiaries/documents` | List beneficiaries pending identity document verification. Supports `page` and `limit`. |
| `GET` | `/hopecard/admin/approvals/beneficiaries/bank` | List beneficiaries pending bank account verification. Supports `page` and `limit`. |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/approve` | Approve a beneficiary application. Body: `adminId`. |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/reject` | Reject a beneficiary application. Body: `adminId`, optional `reason`. |
| `GET` | `/hopecard/admin/approvals/beneficiaries/:id/history` | Retrieve the full approval/rejection history for a specific beneficiary. |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/donate` | Manually send a donation to an approved beneficiary. Body: `adminId`, `amount`, optional `campaign`, optional `notes`. |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/documents/approve` | Approve a beneficiary's submitted identity documents. Body: `adminId`. |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/documents/reject` | Reject a beneficiary's submitted identity documents. Body: `adminId`, optional `reason`. |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/bank/approve` | Approve a beneficiary's bank account details. Body: `adminId`. |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/bank/reject` | Reject a beneficiary's bank account details. Body: `adminId`, optional `reason`. |

---

### Approvals — Campaign Managers

Requires `@RequirePersona('admin', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/admin/approvals/campaign-managers` | List all pending campaign manager approval requests. Supports `page` and `limit`. |
| `POST` | `/hopecard/admin/approvals/campaign-managers/:id/approve` | Approve a campaign manager application. Body: `adminId`. |
| `POST` | `/hopecard/admin/approvals/campaign-managers/:id/reject` | Reject a campaign manager application. Body: `adminId`, optional `reason`. |
| `GET` | `/hopecard/admin/approvals/campaign-managers/:id/history` | Retrieve the approval/rejection history for a specific campaign manager. |

---

### Approvals — Digital Donors

Requires `@RequirePersona('admin', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/admin/approvals/digital-donors` | List all pending digital donor approval requests. Supports `page` and `limit`. |
| `POST` | `/hopecard/admin/approvals/digital-donors/:id/approve` | Approve a digital donor account. Body: `adminId`. |
| `POST` | `/hopecard/admin/approvals/digital-donors/:id/reject` | Reject a digital donor account. Body: `adminId`, optional `reason`. |
| `GET` | `/hopecard/admin/approvals/digital-donors/:id/history` | Retrieve the approval/rejection history for a specific digital donor. |

---

### Activity Log

Requires `@RequirePersona('admin', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/admin/activity/log` | Record an admin action in the audit log. Body: `admin_id`, `admin_email`, `action`, `description`, `resource_type`, `resource_id`, optional `changes`, `ip_address`, `user_agent`. Returns `201 Created`. |
| `GET` | `/hopecard/admin/activity` | Retrieve paginated audit log entries. Query params: `page`, `limit`, `admin_id`, `action`, `resource_type`, `date_from`, `date_to`. |
| `GET` | `/hopecard/admin/activity/recent` | Retrieve recent activity within a time window. Query param: `hours`. |
| `GET` | `/hopecard/admin/activity/by-admin/:adminId` | List all activity for a specific admin user. Supports `page` and `limit`. |
| `GET` | `/hopecard/admin/activity/by-resource/:resourceType` | List all activity for a specific resource type (e.g. `beneficiary`, `campaign`). Supports `page` and `limit`. |
| `GET` | `/hopecard/admin/activity/by-action/:action` | List all activity for a specific action type. Supports `page` and `limit`. |
| `POST` | `/hopecard/admin/activity/cleanup` | Delete audit log entries older than a specified number of days. Query param: `days` (default: 90). |

---

### Dashboard

Requires `@RequirePersona('admin', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/admin/dashboard/metrics` | Retrieve aggregated platform metrics for the admin dashboard (totals, pending counts, financial summaries, etc.). |

---

## 2. Beneficiary Service — `/hopecard/beneficiary`

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/beneficiary/auth/login` | Log in with `email` and `password`. Returns a JWT on success. |
| `POST` | `/hopecard/beneficiary/auth/forgot-password` | Initiate password reset. Body: `email`. Sends a reset OTP to the beneficiary. |
| `POST` | `/hopecard/beneficiary/auth/verify-reset-otp` | Verify the OTP received for password reset. Body: `email`, `otp`. Returns a `reset_token`. |
| `POST` | `/hopecard/beneficiary/auth/reset-password` | Set a new password using the reset token. Body: `reset_token`, `new_password`. |

---

### Bank Accounts

Requires `@RequirePersona('beneficiary', 'hopecard')`. All operations are scoped to the authenticated beneficiary.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/beneficiary/bank-accounts` | Retrieve all bank accounts linked to the authenticated beneficiary. |
| `POST` | `/hopecard/beneficiary/bank-accounts` | Add a new bank account. Body: `bank_name`, `account_holder_name`, `account_number`. |
| `PATCH` | `/hopecard/beneficiary/bank-accounts/:id` | Update a specific bank account. Body (all optional): `bank_name`, `account_holder_name`, `account_number`, `is_primary`. |
| `DELETE` | `/hopecard/beneficiary/bank-accounts/:id` | Remove a specific bank account by ID. |

---

### Campaigns

Requires `@RequirePersona('beneficiary', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/beneficiary/campaigns` | List all campaigns the authenticated beneficiary is enrolled in. |
| `GET` | `/hopecard/beneficiary/campaigns/invitations` | List all pending campaign invitations sent to the beneficiary. |
| `GET` | `/hopecard/beneficiary/campaigns/:id` | Retrieve details for a specific campaign the beneficiary is enrolled in. |
| `POST` | `/hopecard/beneficiary/campaigns/invitations/:id/accept` | Accept a campaign invitation by invitation ID. |
| `POST` | `/hopecard/beneficiary/campaigns/invitations/:id/decline` | Decline a campaign invitation by invitation ID. |

---

### Identity Documents

Requires `@RequirePersona('beneficiary', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/beneficiary/identity-documents` | List all identity documents submitted by the authenticated beneficiary. |
| `POST` | `/hopecard/beneficiary/identity-documents` | Upload a new identity document. Multipart form: `file` (required), optional `label`. |
| `DELETE` | `/hopecard/beneficiary/identity-documents/:id` | Delete a specific identity document by ID. |
| `POST` | `/hopecard/beneficiary/identity-documents/signed-url` | Generate a signed URL for securely accessing a stored document. Body: `documentKey`. |

---

### Withdrawals

Requires `@RequirePersona('beneficiary', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/beneficiary/withdrawals` | Retrieve the withdrawal history for the authenticated beneficiary. |
| `POST` | `/hopecard/beneficiary/withdrawals` | Submit a withdrawal request. Body: `amount`, optional `bank_account_id`, optional `notes`. |

---

### Notifications

Requires `@RequirePersona('beneficiary', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/beneficiary/notifications` | Retrieve all notifications for the authenticated beneficiary. |

---

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/beneficiary/health` | Health check endpoint. Returns service status. No authentication required. |

---

## 3. Donor Service — `/hopecard/donor`

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/donor/auth/signup` | Register a new donor account. Body: signup fields (name, email, password, etc.). |
| `POST` | `/hopecard/donor/auth/login` | Log in with `email` and `password`. Returns a JWT. |
| `POST` | `/hopecard/donor/auth/forgot-password` | Initiate password reset. Body: `email`. |
| `POST` | `/hopecard/donor/auth/verify-otp` | Verify OTP sent for password reset. Body: `email`, `otp`. |
| `POST` | `/hopecard/donor/auth/reset-password` | Complete password reset. Body: `reset_token`, `new_password`. |
| `GET` | `/hopecard/donor/auth/google/url` | Retrieve the Google OAuth authorization URL to redirect the donor to for sign-in. |
| `GET` | `/hopecard/donor/auth/google/callback` | Handle the OAuth callback after Google authentication. Query param: `code`. Exchanges code for a JWT. |

---

### Campaigns

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/donor/campaigns/public` | Retrieve publicly visible campaigns without authentication. Query params: optional `category`, optional `search`. |
| `GET` | `/hopecard/donor/campaigns` | Retrieve all campaigns available to an authenticated donor. Requires `@RequirePersona('donor', 'hopecard')`. Query params: optional `category`, optional `search`. |

---

### Cart

Requires `@RequirePersona('donor', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/donor/cart` | Retrieve the current donor's cart. Query param: `authUserId`. |
| `POST` | `/hopecard/donor/cart` | Add a hopecard item to the cart. Body: `authUserId`, `campaign_id`, `face_value`, `quantity`. |
| `PATCH` | `/hopecard/donor/cart` | Update the quantity of an existing cart item. Body: `authUserId`, `cart_item_id`, `quantity`. |
| `DELETE` | `/hopecard/donor/cart` | Remove an item from the cart. Body: `authUserId`, `cart_item_id`. |

---

### Purchases

Requires `@RequirePersona('donor', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/donor/purchases/checkout` | Create a new checkout session from the donor's cart. Body: optional `authUserId` / `buyerAuthId`, optional `successBaseUrl`, `successUrl`, `cancelUrl`. Returns a checkout session with a payment URL. |
| `GET` | `/hopecard/donor/purchases/checkout/:checkoutId` | Retrieve the current state of an existing checkout session. |
| `POST` | `/hopecard/donor/purchases/checkout/:checkoutId/cancel` | Cancel an active checkout session. |
| `POST` | `/hopecard/donor/purchases/confirm` | Confirm a completed purchase after payment. Body: optional `authUserId` / `buyerAuthId`, `checkoutId`, `referenceId`. Finalizes hopecard issuance. |
| `GET` | `/hopecard/donor/purchases` | Retrieve the authenticated donor's purchase history. Query param: `authUserId`. |

---

### Profile

Requires `@RequirePersona('donor', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/donor/profile` | Retrieve the donor's profile. Query params: `authUserId`, optional `email`. |
| `PATCH` | `/hopecard/donor/profile` | Update the donor's profile details. Body: `authUserId` plus any fields to update. |
| `GET` | `/hopecard/donor/impact` | Retrieve a summary of the donor's total giving impact (total donated, campaigns supported, beneficiaries helped). Query param: `authUserId`. |

---

### Global Stats

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/donor/global-stats` | Retrieve platform-wide statistics (total donations, campaigns, beneficiaries). No authentication required. |

---

### Notifications

Requires `@RequirePersona('donor', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/donor/notifications` | Retrieve all notifications for the authenticated donor. |
| `PATCH` | `/hopecard/donor/notifications/read-all` | Mark all of the authenticated donor's notifications as read. |
| `PATCH` | `/hopecard/donor/notifications/:id/read` | Mark a specific notification as read by notification ID. |

---

## 4. Campaign Manager Service — `/hopecard/cm`

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/cm/auth/login` | Log in with `email` and `password`. Returns a JWT. |
| `GET` | `/hopecard/cm/auth/manager/:authUserId` | Retrieve the campaign manager's own profile by their auth user ID. Requires `@RequirePersona('cm', 'hopecard')`. |
| `GET` | `/hopecard/cm/auth/beneficiaries` | Retrieve beneficiary profiles associated with the manager's campaigns. Requires `@RequirePersona('cm', 'hopecard')`. Query param: `status` to filter by approval status. |

---

### Campaigns

Requires `@RequirePersona('cm', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/cm/campaigns` | Create a new campaign. Body: campaign details (name, description, goal, beneficiaries, etc.). |
| `GET` | `/hopecard/cm/campaigns` | List all campaigns managed by the authenticated campaign manager. |

---

### Reporting

Requires `@RequirePersona('cm', 'hopecard')`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/cm/reporting/dashboard/:authUserId` | Retrieve dashboard reporting data for the campaign manager — campaign performance, donations received, and beneficiary counts. |

---

## 5. Notification Service — `/hopecard/notification`

This is an internal service. It is not intended to be called directly from the frontend.

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/notification/notifications/send-email` | Send a transactional email. Body: `to` (recipient address), `subject`, `html` (email body as HTML string). |

---

## Common Patterns

### Pagination

All list endpoints that return potentially large datasets support these query parameters:

| Parameter | Type | Description |
|---|---|---|
| `page` | `number` | Page number, 1-indexed. |
| `limit` | `number` | Number of records per page. |

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success — data returned. |
| `201` | Created — new resource was created. |
| `204` | No Content — resource was deleted. |
| `401` | Unauthorized — missing or invalid JWT. |
| `403` | Forbidden — valid JWT but wrong persona/role. |

### Correlation IDs

Every request that passes through any Hopecard service is assigned a correlation ID via `CorrelationIdMiddleware`. Include the `X-Correlation-Id` header in requests to trace a specific transaction across services.
