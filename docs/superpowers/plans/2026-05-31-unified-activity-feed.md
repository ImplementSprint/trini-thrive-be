# Unified Activity Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified activity feed endpoint to the admin service that aggregates donations, campaigns, and account approvals alongside existing admin action logs, and update the dashboard frontend to consume it with expanded filter tabs.

**Architecture:** A new `getUnifiedActivity()` method is added to `ActivityService` that queries `activity_logs`, `hopecard_purchases`, `hc_campaigns`, and the three profile tables in parallel, normalizes results into a single `UnifiedActivity` shape, sorts by `created_at` descending, and returns the merged list. A new `GET /hopecard/admin/activity/unified` route exposes it. The frontend dashboard replaces its single `/activity` fetch with `/activity/unified` and expands filter tabs from 4 to 7.

**Tech Stack:** NestJS + Supabase JS client (backend), Next.js 14 App Router + CSS Modules (frontend)

---

## File Map

| File | Change |
|---|---|
| `apps/hopecard-admin-service/src/analytics/activity.service.ts` | Add `UnifiedActivity` interface + `getUnifiedActivity()` method |
| `apps/hopecard-admin-service/src/analytics/activity.controller.ts` | Add `GET /unified` route |
| `Frontend/.../dashboard/page.tsx` | Change fetch URL, simplify type mapping, expand filters |
| `Frontend/.../dashboard/page.module.css` | Add `.ban`, `.suspension`, `.campaign` dot + badge classes |

Frontend base path: `C:/Users/arjel/Downloads/TriniThrive_Hopecard/Frontend/trini-thrive-fe/hope-card/src/app/(admin)/admin/dashboard`

---

## Task 1: Add `getUnifiedActivity()` to ActivityService

**Files:**
- Modify: `apps/hopecard-admin-service/src/analytics/activity.service.ts`

- [ ] **Step 1: Add the `UnifiedActivity` interface** at the top of `activity.service.ts`, just after the existing `Activity` interface (around line 16):

```ts
export interface UnifiedActivity {
  id: string;
  type: 'approval' | 'rejection' | 'donation' | 'campaign' | 'ban' | 'suspension' | 'status_update';
  description: string;
  resource_type: string;
  created_at: string;
}
```

- [ ] **Step 2: Add the `getUnifiedActivity()` method** inside `ActivityService`, after the `deleteOldActivities` method (end of the class, before the closing `}`):

```ts
async getUnifiedActivity(limit: number = 50): Promise<UnifiedActivity[]> {
  try {
    const [
      logsResult,
      donationsResult,
      campaignsResult,
      donorProfilesResult,
      managerProfilesResult,
      beneficiaryProfilesResult,
    ] = await Promise.all([
      supabase
        .from('activity_logs')
        .select('id, action, description, resource_type, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('hopecard_purchases')
        .select('id, amount_paid, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('hc_campaigns')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('digital_donor_profiles')
        .select('id, first_name, last_name, updated_at')
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(limit),
      supabase
        .from('campaign_manager_profiles')
        .select('id, first_name, last_name, updated_at')
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(limit),
      supabase
        .from('beneficiary_profiles')
        .select('id, first_name, last_name, updated_at')
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(limit),
    ]);

    const unified: UnifiedActivity[] = [];

    // Map activity_logs
    for (const log of logsResult.data ?? []) {
      let type: UnifiedActivity['type'] = 'status_update';
      const action = (log.action ?? '').toUpperCase();
      const desc = (log.description ?? '').toLowerCase();

      if (action === 'APPROVED') {
        type = 'approval';
      } else if (action === 'REJECTED') {
        type = 'rejection';
      } else if (desc.includes('ban')) {
        type = 'ban';
      } else if (desc.includes('suspend')) {
        type = 'suspension';
      }

      unified.push({
        id: log.id,
        type,
        description: log.description ?? '',
        resource_type: log.resource_type ?? 'admin_action',
        created_at: log.created_at,
      });
    }

    // Map donations
    for (const donation of donationsResult.data ?? []) {
      const amount = parseFloat(String(donation.amount_paid)) || 0;
      unified.push({
        id: donation.id,
        type: 'donation',
        description: `Donation of ₱${amount.toFixed(2)} received`,
        resource_type: 'donation',
        created_at: donation.created_at,
      });
    }

    // Map campaigns
    for (const campaign of campaignsResult.data ?? []) {
      unified.push({
        id: campaign.id,
        type: 'campaign',
        description: `Campaign '${campaign.title}' created`,
        resource_type: 'campaign',
        created_at: campaign.created_at,
      });
    }

    // Map approved digital donors
    for (const profile of donorProfilesResult.data ?? []) {
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unknown';
      unified.push({
        id: profile.id,
        type: 'approval',
        description: `Digital donor account approved: ${name}`,
        resource_type: 'digital_donor',
        created_at: profile.updated_at,
      });
    }

    // Map approved campaign managers
    for (const profile of managerProfilesResult.data ?? []) {
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unknown';
      unified.push({
        id: profile.id,
        type: 'approval',
        description: `Campaign manager account approved: ${name}`,
        resource_type: 'campaign_manager',
        created_at: profile.updated_at,
      });
    }

    // Map approved beneficiaries
    for (const profile of beneficiaryProfilesResult.data ?? []) {
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unknown';
      unified.push({
        id: profile.id,
        type: 'approval',
        description: `Beneficiary account approved: ${name}`,
        resource_type: 'beneficiary',
        created_at: profile.updated_at,
      });
    }

    // Sort all by created_at descending, return top `limit`
    unified.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return unified.slice(0, limit);
  } catch (error) {
    console.error('❌ Exception in getUnifiedActivity:', error);
    return [];
  }
}
```

- [ ] **Step 3: Verify the file compiles**

Run from the repo root:
```bash
npx tsc -p apps/hopecard-admin-service/tsconfig.app.json --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/hopecard-admin-service/src/analytics/activity.service.ts
git commit -m "feat(admin): add getUnifiedActivity — aggregates logs, donations, campaigns, approvals"
```

---

## Task 2: Add GET /unified route to ActivityController

**Files:**
- Modify: `apps/hopecard-admin-service/src/analytics/activity.controller.ts`

- [ ] **Step 1: Add the import for `UnifiedActivity`**

At the top of `activity.controller.ts`, update the import from `activity.service.ts` to also import `UnifiedActivity`:

```ts
import type { Activity, UnifiedActivity } from './activity.service';
```

- [ ] **Step 2: Add the route handler** inside `ActivityController`, after the `getRecentActivity` handler (around line 101) and before `getActivityByAdmin`:

```ts
@Get('unified')
async getUnifiedActivity(
  @Query('limit') limit: string = '50',
): Promise<UnifiedActivity[]> {
  try {
    const limitNum = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
    return await this.activityService.getUnifiedActivity(limitNum);
  } catch (error) {
    console.error('❌ Error in getUnifiedActivity:', error);
    return [];
  }
}
```

> **Important:** This route must be declared **before** the `@Get('by-admin/:adminId')` and `@Get('by-resource/:resourceType')` parameterised routes to avoid NestJS routing conflicts. The existing `@Get('recent')` route is already in that position — add `unified` right after `recent`.

- [ ] **Step 3: Verify the file compiles**

```bash
npx tsc -p apps/hopecard-admin-service/tsconfig.app.json --noEmit
```
Expected: no errors.

- [ ] **Step 4: Start the admin service and verify the route responds**

```bash
npm run start:hopecard-admin-service:dev
```

In a second terminal (with a valid admin JWT in `$TOKEN`):
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:4020/api/v1/hopecard/admin/activity/unified?limit=10
```
Expected: JSON array (may be empty `[]` if no data, but must not 404 or 500).

- [ ] **Step 5: Commit**

```bash
git add apps/hopecard-admin-service/src/analytics/activity.controller.ts
git commit -m "feat(admin): expose GET /activity/unified route"
```

---

## Task 3: Add new CSS classes to page.module.css

**Files:**
- Modify: `Frontend/.../dashboard/page.module.css`

- [ ] **Step 1: Add timeline dot colours** for the three new types. Append after the existing `.timelineDot.rejection` block (line 229):

```css
.timelineDot.ban {
  background-color: #f97316;
}

.timelineDot.suspension {
  background-color: #eab308;
}

.timelineDot.campaign {
  background-color: #8b5cf6;
}

.timelineDot.status_update {
  background-color: #6b7280;
}
```

- [ ] **Step 2: Add badge styles** for the three new types. Append after the existing `.badge-rejection` block (line 296):

```css
.badge-ban {
  background-color: #ffedd5;
  color: #9a3412;
  border: 1px solid #fed7aa;
}

.badge-suspension {
  background-color: #fef9c3;
  color: #854d0e;
  border: 1px solid #fef08a;
}

.badge-campaign {
  background-color: #ede9fe;
  color: #5b21b6;
  border: 1px solid #ddd6fe;
}

.badge-status_update {
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #e5e7eb;
}
```

- [ ] **Step 3: Commit**

```bash
git add "Frontend/trini-thrive-fe/hope-card/src/app/(admin)/admin/dashboard/page.module.css"
git commit -m "style(admin-dashboard): add ban, suspension, campaign, status_update dot and badge classes"
```

---

## Task 4: Update dashboard page.tsx

**Files:**
- Modify: `Frontend/.../dashboard/page.tsx`

- [ ] **Step 1: Update the `Activity` interface** (around line 27). Replace the existing interface:

```ts
interface Activity {
  id: string;
  description: string;
  time: string;
  type: 'approval' | 'rejection' | 'donation' | 'campaign' | 'ban' | 'suspension' | 'status_update';
  resource_type: string;
}
```

- [ ] **Step 2: Expand the `filters` array** (around line 236). Replace the existing filters:

```ts
const filters = ["All", "Approvals", "Rejections", "Donations Sent", "Campaigns", "Banned", "Suspensions"];
```

- [ ] **Step 3: Update the `filteredActivities` logic** (around line 239). Replace the existing filter block:

```ts
const filteredActivities = activities.filter((activity) => {
  if (activeFilter === "All") return true;
  if (activeFilter === "Approvals") return activity.type === "approval";
  if (activeFilter === "Rejections") return activity.type === "rejection";
  if (activeFilter === "Donations Sent") return activity.type === "donation";
  if (activeFilter === "Campaigns") return activity.type === "campaign";
  if (activeFilter === "Banned") return activity.type === "ban";
  if (activeFilter === "Suspensions") return activity.type === "suspension";
  return false;
});
```

- [ ] **Step 4: Replace `fetchActivities`** — the function inside the `useEffect` (starting around line 146). Replace the entire `fetchActivities` function with the version below. Key changes: new URL, simplified mapping (backend already normalises types), removed the old action-string guessing logic:

```ts
const fetchActivities = async () => {
  try {
    const backendUrl = await getBackendUrlCached();
    const token = localStorage.getItem('admin_token');

    const response = await fetch(
      `${backendUrl}/api/v1/hopecard/admin/activity/unified?limit=50`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      },
    );

    if (response.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
      return;
    }

    if (!response.ok) {
      setActivities([]);
      return;
    }

    const raw: Array<{
      id: string;
      type: Activity['type'];
      description: string;
      resource_type: string;
      created_at: string;
    }> = await response.json();

    const formatted: Activity[] = raw.map((item) => {
      const createdAt = new Date(item.created_at);
      const now = new Date();
      const diff = now.getTime() - createdAt.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      let timeStr = 'just now';
      if (minutes < 60) {
        timeStr = `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
      } else if (hours < 24) {
        timeStr = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      } else if (days < 7) {
        timeStr = `${days} day${days !== 1 ? 's' : ''} ago`;
      }

      return {
        id: item.id ?? Math.random().toString(),
        description: item.description,
        time: timeStr,
        type: item.type,
        resource_type: item.resource_type,
      };
    });

    setActivities(formatted);
  } catch (err) {
    console.error('❌ Error fetching activities:', err);
    setActivities([]);
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 5: Update the activity item render block** in the JSX (around line 314). The current render uses `activity.action` and `activity.subject` — replace it to use `activity.description` directly, and derive a badge label from the type:

Replace the `<div key={activity.id} className={styles.activityItem}>` block with:

```tsx
<div key={activity.id} className={styles.activityItem}>
  <div className={`${styles.timelineDot} ${styles[activity.type]}`}></div>

  <div className={`${styles.activityContent} ${index !== filteredActivities.length - 1 ? styles.hasBorder : ""}`}>
    <span className={styles.time}>{activity.time}</span>
    <p className={styles.actionText}>{activity.description}</p>
    <span className={`${styles.badge} ${styles[`badge-${activity.type}`]}`}>
      • {activity.type === 'approval' ? 'Approved'
        : activity.type === 'rejection' ? 'Rejected'
        : activity.type === 'donation' ? 'Donation'
        : activity.type === 'campaign' ? 'Campaign Created'
        : activity.type === 'ban' ? 'Banned'
        : activity.type === 'suspension' ? 'Suspended'
        : 'Status Update'}
    </span>
  </div>
</div>
```

- [ ] **Step 6: Verify the frontend compiles**

From the frontend directory:
```bash
cd C:/Users/arjel/Downloads/TriniThrive_Hopecard/Frontend/trini-thrive-fe/hope-card
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Run the frontend and visually verify**

```bash
npm run dev
```

Open `http://localhost:3001/admin/dashboard`. Confirm:
- Activity feed loads (even if empty, no errors in console)
- 7 filter tabs appear: All, Approvals, Rejections, Donations Sent, Campaigns, Banned, Suspensions
- Clicking each tab filters correctly
- Timeline dots and badges use the right colours for each type

- [ ] **Step 8: Commit**

```bash
git add "Frontend/trini-thrive-fe/hope-card/src/app/(admin)/admin/dashboard/page.tsx"
git commit -m "feat(admin-dashboard): unified activity feed — 7 filter tabs, donations, campaigns, account approvals"
```
