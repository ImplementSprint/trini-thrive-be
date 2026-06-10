# Hopecard Technical Overview

> For full request/response body details on every endpoint, see [APIGuide.md](./APIGuide.md).

---

## Table of Contents

1. [What is Hopecard?](#1-what-is-hopecard)
2. [Architecture](#2-architecture)
3. [Security](#3-security)
4. [APIs](#4-apis)

---

## 1. What is Hopecard?

Hopecard is a digital charitable giving platform that connects people who want to donate with people who need support. Donors browse active campaigns, purchase digital "hopecards" at a chosen value, and that value is distributed to beneficiaries through verified bank accounts. Campaign managers organize and run the campaigns. Admins oversee the entire platform — approving accounts, verifying documents, and monitoring activity.

### Who uses it?

| Role | What they do |
|---|---|
| **Donor** | Browses public campaigns, creates an account, purchases hopecards, and tracks their giving impact |
| **Beneficiary** | Receives aid through campaigns, submits identity documents and bank details for verification, and requests withdrawals |
| **Campaign Manager** | Creates and manages campaigns, invites beneficiaries, and monitors campaign performance |
| **Admin** | Approves or rejects accounts and documents, sends manual donations, monitors platform-wide activity, and manages the dashboard |

### How to use this document

If you are a stakeholder or product manager, the plain-English summaries at the start of each section give you what you need. If you are a developer or integration partner, the tables and technical detail follow each summary. For the complete list of request/response parameters on every endpoint, refer to [APIGuide.md](./APIGuide.md).

---

## 2. Architecture

Hopecard is built as a set of independent microservices — each one dedicated to a single role on the platform. Rather than one large application handling everything, each service has its own responsibilities, its own codebase, and its own deployment. This means a change to the donor experience has no risk of breaking the admin portal, and each service can be scaled independently based on demand.

All five services share a common internal library (`libs/common`) that enforces consistent security, error handling, request validation, and logging across the entire platform. This ensures that foundational behaviour is never duplicated or inconsistently applied.

### Services at a glance

| Service | Port | Purpose |
|---|---|---|
| **Admin Service** | 3101 | Platform management: approvals, beneficiary management, activity audit log, analytics dashboard |
| **Beneficiary Service** | 3102 | Aid recipient portal: profile, bank accounts, identity documents, campaigns, withdrawals |
| **Campaign Manager Service** | 3103 | Campaign creation, beneficiary management, and reporting dashboard |
| **Donor Service** | 3104 | Browsing campaigns, cart, purchasing hopecards, profile, impact tracking |
| **Notification Service** | 3105 | Internal email delivery — not directly user-facing; called by other services |

### How services communicate

Services communicate in two ways:

- **Direct HTTP calls** — for real-time requests where one service needs data from another immediately (e.g. the donor service fetching campaign details).
- **Event streaming via Kafka** — for fire-and-forget notifications where the sender does not need to wait for a response (e.g. emitting a `hopecard.donation.completed` event after a purchase). This keeps services loosely coupled — the sender doesn't care who is listening.

### Database

All services use **Supabase (PostgreSQL)** as their database. Each service connects using its own scoped credentials, so data access is isolated even though the underlying infrastructure is shared. The `SupabaseService` library manages client initialization, scoped client support, and health checks centrally.

### Deployment

Each service runs in its own **Docker container** (Node 22 Alpine, non-root user) and is deployed through a **GitHub Actions CI/CD pipeline** to **Render** across three environments: `test`, `UAT`, and `production`. The pipeline supports optional security scanning (Trivy), code quality analysis (SonarCloud), and performance testing (Grafana k6).

### Bootstrap pattern

Every service starts up the same way through a shared `bootstrapHttpApp()` function. This function wires up all global middleware, security headers, validation, and error handling before the service begins accepting requests — ensuring nothing is missed.

---

## 3. Security

Hopecard uses a layered security model. Every incoming request passes through multiple independent checks before reaching any data. If one layer is misconfigured or bypassed, the others still protect the system.

### Authentication — JWT

Every protected endpoint requires a **JWT (JSON Web Token)** in the `Authorization: Bearer <token>` header (or an `admin_token` cookie for the admin service). Tokens are signed using the **HS256 algorithm** and verified against a `JWT_SECRET` environment variable.

Each token carries:
- `sub` — the user's unique ID
- `email` — the user's email address
- `persona` — their role (e.g. `admin`, `donor`, `beneficiary`, `cm`)
- `system` — which platform they belong to (e.g. `hopecard`)
- `iat` / `exp` — issued-at and expiry timestamps

Token lifetimes:
- **Admin tokens**: 8 hours
- **All other tokens**: 24 hours

### Role-based access — Persona Guard

Verifying that a token is valid is only the first check. Every protected route also verifies that the token's `persona` and `system` claims match what the route expects. A donor's valid JWT cannot be used to call an admin endpoint — even if the token itself passes cryptographic verification. This is enforced via the `@RequirePersona(role, system)` decorator applied at the controller level.

### Two-factor login (Admin)

Admin login uses a two-step flow:
1. Submit email and password → server sends a **6-digit OTP** via email.
2. Submit the OTP → server issues a JWT.

OTPs expire in **10 minutes** and can only be used once.

### Password reset flow (Beneficiary, Donor, Campaign Manager)

1. Request a reset with your email → server sends an OTP.
2. Verify the OTP → server issues a time-limited **reset token** (Base64-encoded, 15-minute TTL).
3. Submit the reset token with a new password → password updated.

### Google OAuth (Donors only)

Donors can sign in via **Google OAuth 2.0** as an alternative to email and password. The donor service handles the full authorization code exchange and issues a platform JWT on success.

### Password storage

Passwords are never stored in plain text. All password hashing is delegated to **Supabase Auth**, which handles bcrypt internally.

### HTTP hardening (Helmet)

Every HTTP response includes security headers enforced by Helmet:

| Header | Value |
|---|---|
| Content Security Policy | `'self'` only — blocks inline scripts and external resources |
| HSTS | 1-year max-age with preload — forces HTTPS |
| X-Frame-Options | No framing allowed — prevents clickjacking |
| X-Content-Type-Options | No MIME sniffing |
| Referrer-Policy | `no-referrer` |

### CORS

Only origins explicitly listed in the `ALLOWED_ORIGINS` environment variable are permitted to make cross-origin requests. There are no wildcards. If `ALLOWED_ORIGINS` is missing or empty, the server rejects all cross-origin requests by default — it fails securely rather than falling back to permissive behaviour.

Allowed request methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
Allowed headers: `Content-Type, Authorization, X-Correlation-ID, X-Request-Id`

### Request validation

All incoming request bodies are validated against strict DTOs using `class-validator`. Unknown or unexpected fields are **rejected outright** — they are not silently ignored or stripped. The maximum allowed request body size is **5MB**.

### Request tracing — Correlation ID

Every request that enters any Hopecard service is assigned a **Correlation ID**. If the client sends an `X-Correlation-ID` header, that value is sanitized and used. If not, a UUID is generated automatically. The ID is attached to all logs and returned in the response header, making it possible to trace a single transaction across multiple services.

---

## 4. APIs

All API endpoints are prefixed with `/api/v1`. Endpoints marked with **[Protected]** require a valid JWT with the matching role. All list endpoints support `page` and `limit` query parameters for pagination. For full request/response body details, see [APIGuide.md](./APIGuide.md).

---

### 4.1 Admin Service — `/hopecard/admin`

The admin service is the internal management portal. It covers authentication, beneficiary and approval management, activity auditing, and platform analytics. All non-auth endpoints require an admin JWT.

#### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/admin/auth/login` | Log in with email and password — triggers OTP delivery |
| `POST` | `/hopecard/admin/auth/verify-otp` | Verify the OTP to complete two-factor login and receive a JWT |
| `POST` | `/hopecard/admin/auth/send-otp` | Resend the OTP to the admin's registered contact |
| `POST` | `/hopecard/admin/auth/change-password` | **[Protected]** Change the authenticated admin's password |
| `GET` | `/hopecard/admin/auth/verify-session` | **[Protected]** Check whether the current JWT session is still valid |
| `POST` | `/hopecard/admin/auth/logout` | **[Protected]** Invalidate the current session and log out |

#### Beneficiary Management

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/admin/beneficiaries` | **[Protected]** List all beneficiaries with pagination |
| `GET` | `/hopecard/admin/beneficiaries/search` | **[Protected]** Search beneficiaries by name or identifier |
| `GET` | `/hopecard/admin/beneficiaries/status/:status` | **[Protected]** Filter beneficiaries by status (e.g. `pending`, `approved`, `rejected`) |
| `GET` | `/hopecard/admin/beneficiaries/:id` | **[Protected]** Get full details for a specific beneficiary |
| `POST` | `/hopecard/admin/beneficiaries` | **[Protected]** Create a new beneficiary record |
| `PUT` | `/hopecard/admin/beneficiaries/:id` | **[Protected]** Update all fields for a beneficiary |
| `DELETE` | `/hopecard/admin/beneficiaries/:id` | **[Protected]** Permanently delete a beneficiary record |

#### Campaigns

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/admin/campaigns` | **[Protected]** List all campaigns across the platform |

#### Approvals — Beneficiaries

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/admin/approvals/beneficiaries` | **[Protected]** List all pending beneficiary approval requests |
| `GET` | `/hopecard/admin/approvals/beneficiaries/documents` | **[Protected]** List beneficiaries pending identity document verification |
| `GET` | `/hopecard/admin/approvals/beneficiaries/bank` | **[Protected]** List beneficiaries pending bank account verification |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/approve` | **[Protected]** Approve a beneficiary application |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/reject` | **[Protected]** Reject a beneficiary application with an optional reason |
| `GET` | `/hopecard/admin/approvals/beneficiaries/:id/history` | **[Protected]** View the full approval/rejection history for a beneficiary |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/donate` | **[Protected]** Manually send a donation to an approved beneficiary |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/documents/approve` | **[Protected]** Approve a beneficiary's submitted identity documents |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/documents/reject` | **[Protected]** Reject a beneficiary's identity documents with an optional reason |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/bank/approve` | **[Protected]** Approve a beneficiary's bank account details |
| `POST` | `/hopecard/admin/approvals/beneficiaries/:id/bank/reject` | **[Protected]** Reject a beneficiary's bank account details with an optional reason |

#### Approvals — Campaign Managers

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/admin/approvals/campaign-managers` | **[Protected]** List all pending campaign manager approval requests |
| `POST` | `/hopecard/admin/approvals/campaign-managers/:id/approve` | **[Protected]** Approve a campaign manager application |
| `POST` | `/hopecard/admin/approvals/campaign-managers/:id/reject` | **[Protected]** Reject a campaign manager application with an optional reason |
| `GET` | `/hopecard/admin/approvals/campaign-managers/:id/history` | **[Protected]** View the approval/rejection history for a campaign manager |

#### Approvals — Digital Donors

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/admin/approvals/digital-donors` | **[Protected]** List all pending digital donor approval requests |
| `POST` | `/hopecard/admin/approvals/digital-donors/:id/approve` | **[Protected]** Approve a digital donor account |
| `POST` | `/hopecard/admin/approvals/digital-donors/:id/reject` | **[Protected]** Reject a digital donor account with an optional reason |
| `GET` | `/hopecard/admin/approvals/digital-donors/:id/history` | **[Protected]** View the approval/rejection history for a digital donor |

#### Activity Log

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/admin/activity/log` | **[Protected]** Record an admin action in the audit log |
| `GET` | `/hopecard/admin/activity` | **[Protected]** Retrieve paginated audit log entries with optional filters |
| `GET` | `/hopecard/admin/activity/recent` | **[Protected]** Retrieve activity within the last N hours |
| `GET` | `/hopecard/admin/activity/by-admin/:adminId` | **[Protected]** List all activity for a specific admin user |
| `GET` | `/hopecard/admin/activity/by-resource/:resourceType` | **[Protected]** List all activity for a specific resource type |
| `GET` | `/hopecard/admin/activity/by-action/:action` | **[Protected]** List all activity for a specific action type |
| `POST` | `/hopecard/admin/activity/cleanup` | **[Protected]** Delete audit log entries older than N days (default: 90) |

#### Dashboard

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/admin/dashboard/metrics` | **[Protected]** Retrieve aggregated platform metrics for the admin dashboard |

---

### 4.2 Beneficiary Service — `/hopecard/beneficiary`

The beneficiary service is the portal for aid recipients. It covers authentication, managing bank accounts and identity documents, viewing campaigns and withdrawal history, and receiving notifications.

#### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/beneficiary/auth/login` | Log in with email and password — returns a JWT |
| `POST` | `/hopecard/beneficiary/auth/forgot-password` | Initiate password reset — sends an OTP to the beneficiary's email |
| `POST` | `/hopecard/beneficiary/auth/verify-reset-otp` | Verify the OTP — returns a time-limited reset token |
| `POST` | `/hopecard/beneficiary/auth/reset-password` | Set a new password using the reset token |

#### Bank Accounts

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/beneficiary/bank-accounts` | **[Protected]** List all bank accounts linked to the authenticated beneficiary |
| `POST` | `/hopecard/beneficiary/bank-accounts` | **[Protected]** Add a new bank account |
| `PATCH` | `/hopecard/beneficiary/bank-accounts/:id` | **[Protected]** Update a specific bank account's details |
| `DELETE` | `/hopecard/beneficiary/bank-accounts/:id` | **[Protected]** Remove a bank account |

#### Campaigns

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/beneficiary/campaigns` | **[Protected]** List all campaigns the beneficiary is enrolled in |
| `GET` | `/hopecard/beneficiary/campaigns/invitations` | **[Protected]** List all pending campaign invitations |
| `GET` | `/hopecard/beneficiary/campaigns/:id` | **[Protected]** Get details for a specific campaign |
| `POST` | `/hopecard/beneficiary/campaigns/invitations/:id/accept` | **[Protected]** Accept a campaign invitation |
| `POST` | `/hopecard/beneficiary/campaigns/invitations/:id/decline` | **[Protected]** Decline a campaign invitation |

#### Identity Documents

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/beneficiary/identity-documents` | **[Protected]** List all submitted identity documents |
| `POST` | `/hopecard/beneficiary/identity-documents` | **[Protected]** Upload a new identity document (multipart file upload) |
| `DELETE` | `/hopecard/beneficiary/identity-documents/:id` | **[Protected]** Delete a specific identity document |
| `POST` | `/hopecard/beneficiary/identity-documents/signed-url` | **[Protected]** Generate a signed URL for securely accessing a stored document |

#### Withdrawals

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/beneficiary/withdrawals` | **[Protected]** View withdrawal history |
| `POST` | `/hopecard/beneficiary/withdrawals` | **[Protected]** Submit a new withdrawal request |

#### Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/beneficiary/notifications` | **[Protected]** Retrieve all notifications for the authenticated beneficiary |

#### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/beneficiary/health` | Service health check — no authentication required |

---

### 4.3 Donor Service — `/hopecard/donor`

The donor service is the public-facing portal for people who want to give. It covers account creation, browsing campaigns, managing a cart, completing purchases, and tracking impact.

#### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/donor/auth/signup` | Register a new donor account |
| `POST` | `/hopecard/donor/auth/login` | Log in with email and password — returns a JWT |
| `POST` | `/hopecard/donor/auth/forgot-password` | Initiate password reset — sends an OTP |
| `POST` | `/hopecard/donor/auth/verify-otp` | Verify the OTP — returns a reset token |
| `POST` | `/hopecard/donor/auth/reset-password` | Set a new password using the reset token |
| `GET` | `/hopecard/donor/auth/google/url` | Get the Google OAuth URL to redirect the donor to |
| `GET` | `/hopecard/donor/auth/google/callback` | Handle the Google OAuth callback and issue a platform JWT |

#### Campaigns

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/donor/campaigns/public` | Browse publicly visible campaigns — no authentication required |
| `GET` | `/hopecard/donor/campaigns` | **[Protected]** Browse campaigns as an authenticated donor |

#### Cart

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/donor/cart` | **[Protected]** View the current cart |
| `POST` | `/hopecard/donor/cart` | **[Protected]** Add a hopecard to the cart |
| `PATCH` | `/hopecard/donor/cart` | **[Protected]** Update the quantity of a cart item |
| `DELETE` | `/hopecard/donor/cart` | **[Protected]** Remove an item from the cart |

#### Purchases

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/donor/purchases/checkout` | **[Protected]** Create a checkout session from the cart — returns a payment URL |
| `GET` | `/hopecard/donor/purchases/checkout/:checkoutId` | **[Protected]** Get the current state of a checkout session |
| `POST` | `/hopecard/donor/purchases/checkout/:checkoutId/cancel` | **[Protected]** Cancel an active checkout session |
| `POST` | `/hopecard/donor/purchases/confirm` | **[Protected]** Confirm a completed payment and finalize hopecard issuance |
| `GET` | `/hopecard/donor/purchases` | **[Protected]** View purchase history |

#### Profile & Impact

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/donor/profile` | **[Protected]** Retrieve the donor's profile |
| `PATCH` | `/hopecard/donor/profile` | **[Protected]** Update the donor's profile details |
| `GET` | `/hopecard/donor/impact` | **[Protected]** View a summary of the donor's total giving impact |

#### Global Stats

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/donor/global-stats` | Platform-wide statistics — no authentication required |

#### Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/donor/notifications` | **[Protected]** Retrieve all notifications |
| `PATCH` | `/hopecard/donor/notifications/read-all` | **[Protected]** Mark all notifications as read |
| `PATCH` | `/hopecard/donor/notifications/:id/read` | **[Protected]** Mark a specific notification as read |

---

### 4.4 Campaign Manager Service — `/hopecard/cm`

The campaign manager service is for users who create and run fundraising campaigns. It covers authentication, campaign creation, and performance reporting.

#### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/cm/auth/login` | Log in with email and password — returns a JWT |
| `GET` | `/hopecard/cm/auth/manager/:authUserId` | **[Protected]** Retrieve the campaign manager's own profile |
| `GET` | `/hopecard/cm/auth/beneficiaries` | **[Protected]** List beneficiary profiles linked to the manager's campaigns |

#### Campaigns

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/cm/campaigns` | **[Protected]** Create a new campaign |
| `GET` | `/hopecard/cm/campaigns` | **[Protected]** List all campaigns managed by the authenticated user |

#### Reporting

| Method | Path | Description |
|---|---|---|
| `GET` | `/hopecard/cm/reporting/dashboard/:authUserId` | **[Protected]** Retrieve dashboard data — campaign performance, donations, and beneficiary counts |

---

### 4.5 Notification Service — `/hopecard/notification`

The notification service is an **internal service** called by other services to deliver emails. It is not intended to be called directly from any frontend application.

| Method | Path | Description |
|---|---|---|
| `POST` | `/hopecard/notification/notifications/send-email` | Send a transactional email (recipient, subject, HTML body) |

---

### Common Patterns

#### Pagination

All list endpoints that return multiple records support:

| Query Param | Description |
|---|---|
| `page` | Page number, 1-indexed |
| `limit` | Number of records per page |

#### Standard HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success — data returned |
| `201` | Created — a new resource was created |
| `204` | No Content — resource was deleted successfully |
| `401` | Unauthorized — JWT is missing or invalid |
| `403` | Forbidden — JWT is valid but the role does not match the endpoint |

#### Correlation ID

Include `X-Correlation-ID` in any request to attach a trace ID that will appear in all service logs for that transaction. If omitted, the platform generates one automatically.
