# Unified Activity Feed — Design Spec

**Date:** 2026-05-31  
**Branch:** feat/hopecard-integration  
**Scope:** Admin dashboard recent-activity section

---

## Goal

Extend the admin dashboard activity feed to include user donations, created campaigns, and approved account creations alongside the existing admin action log. Add filter tabs for Campaigns, Banned, and Suspensions.

---

## Final Filter Tabs

| Tab | Types matched |
|---|---|
| All | all |
| Approvals | `approval` |
| Rejections | `rejection` |
| Donations Sent | `donation` |
| Campaigns | `campaign` |
| Banned | `ban` |
| Suspensions | `suspension` |

---

## Backend

### New method: `ActivityService.getUnifiedActivity(limit: number = 50)`

Runs five Supabase queries in parallel:

1. **`activity_logs`** — all existing admin actions. Maps `action` to `type`:
   - `APPROVED` → `approval`
   - `REJECTED` → `rejection`
   - `BAN` / `BANNED` → `ban`
   - `SUSPEND` / `SUSPENDED` → `suspension`
   - anything else → `status_update`

2. **`hopecard_purchases`** — selects `id`, `amount_paid`, `created_at`, plus donor identifier if available. Maps to `type: donation`. Description: `"Donation of ₱{amount_paid} received"`.

3. **`hc_campaigns`** — selects `id`, `title`, `created_by`, `status`, `created_at`. Maps to `type: campaign`. Description: `"Campaign '{title}' created"`.

4. **`digital_donor_profiles`** where `status = 'approved'` — selects `id`, `first_name`, `last_name`, `updated_at`. Maps to `type: approval`, `resource_type: digital_donor`. Description: `"Digital donor account approved: {name}"`.

5. **`campaign_manager_profiles`** where `status = 'approved'` — same shape. `resource_type: campaign_manager`.

6. **`beneficiary_profiles`** where `status = 'approved'` — same shape. `resource_type: beneficiary`.

All results are normalized to:

```ts
interface UnifiedActivity {
  id: string;
  type: 'approval' | 'rejection' | 'donation' | 'campaign' | 'ban' | 'suspension' | 'status_update';
  description: string;
  resource_type: string;
  created_at: string;
}
```

Merged array is sorted by `created_at` descending, sliced to `limit`.

### New route

```
GET /hopecard/admin/activity/unified?limit=50
```

- Requires `@RequirePersona('admin', 'hopecard')` (same as existing activity routes)
- Returns `UnifiedActivity[]`
- Existing `/hopecard/admin/activity` routes are **not changed**

---

## Frontend

**File:** `src/app/(admin)/admin/dashboard/page.tsx`

- `fetchActivities` hits `/hopecard/admin/activity/unified` instead of `/hopecard/admin/activity`
- Response is already normalized — time-ago formatting logic stays, type-mapping logic removed
- `Activity` interface `type` field matches `UnifiedActivity.type` directly
- `filters` array: `["All", "Approvals", "Rejections", "Donations Sent", "Campaigns", "Banned", "Suspensions"]`
- Filter logic:

```ts
if (activeFilter === "Approvals") return activity.type === "approval";
if (activeFilter === "Rejections") return activity.type === "rejection";
if (activeFilter === "Donations Sent") return activity.type === "donation";
if (activeFilter === "Campaigns") return activity.type === "campaign";
if (activeFilter === "Banned") return activity.type === "ban";
if (activeFilter === "Suspensions") return activity.type === "suspension";
```

**File:** `src/app/(admin)/admin/dashboard/page.module.css`

- Add timeline dot colour classes: `.ban`, `.suspension`, `.campaign`
- Add badge colour classes: `.badge-ban`, `.badge-suspension`, `.badge-campaign`

---

## Out of Scope

- Pagination on the unified feed (limit=50 is sufficient for dashboard view)
- Real-time / websocket updates
- Historical backfill of donation/campaign data into `activity_logs`
- Changes to other pages (approvals, user management, etc.)
