# Partner Public Campaign API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a read-only public API at `/api/v1/hopecard/public/campaigns` that lets partner sites display HopeCard campaigns using a simple API key header, with per-key daily rate limiting and instant revocation.

**Architecture:** A new `PublicModule` is added to the donor service containing a NestJS `CanActivate` guard that validates `X-Api-Key` against a `partner_api_keys` Supabase table, an in-memory daily rate limiter, and a read-only controller that reuses the same `supabaseRequest` + `getStorageUrl` pattern already used by `CampaignsService`. The module is registered in `HopecardDonorServiceModule` alongside the existing modules.

**Tech Stack:** NestJS, TypeScript, Supabase (PostgREST), `@app/common/supabase-helpers`, `@app/common/storage`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| **Create** | `supabase/migrations/20260530_partner_api_keys.sql` | DB table + seed key |
| **Create** | `apps/hopecard-donor-service/src/public/api-key.guard.ts` | Validates X-Api-Key, enforces daily rate limit |
| **Create** | `apps/hopecard-donor-service/src/public/public.service.ts` | Fetches campaign data from Supabase |
| **Create** | `apps/hopecard-donor-service/src/public/public.controller.ts` | GET /hopecard/public/campaigns and /:id |
| **Create** | `apps/hopecard-donor-service/src/public/public.module.ts` | Wires guard, service, controller |
| Modify | `apps/hopecard-donor-service/src/donor-service.module.ts` | Import PublicModule |

> **Backend root:** `C:\Users\arjel\Downloads\TriniThrive_Hopecard\Backend\trini-thrive-be\`

---

### Task 1: Database — create `partner_api_keys` table and seed a test key

**Files:**
- Create: `supabase/migrations/20260530_partner_api_keys.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Partner API keys for read-only public campaign access
CREATE TABLE IF NOT EXISTS public.partner_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT UNIQUE NOT NULL,
  partner_name    TEXT NOT NULL,
  allowed_origin  TEXT,               -- optional CORS origin e.g. 'https://partner.com'
  is_active       BOOLEAN NOT NULL DEFAULT true,
  daily_limit     INT NOT NULL DEFAULT 1000,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disable RLS — this table is only ever read by the service-role key on the backend
ALTER TABLE public.partner_api_keys DISABLE ROW LEVEL SECURITY;

-- Seed one test key for development
INSERT INTO public.partner_api_keys (key, partner_name, daily_limit)
VALUES ('pk_test_hopecard_partner_dev', 'Dev Partner', 1000)
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP `apply_migration` tool with:
- `project_id`: `hycsbfugiboutvgbvueg`
- `name`: `create_partner_api_keys`
- `query`: the SQL above

- [ ] **Step 3: Verify the table and seed row exist**

Run via `execute_sql`:
```sql
SELECT id, key, partner_name, is_active, daily_limit FROM public.partner_api_keys;
```
Expected: one row with `key = 'pk_test_hopecard_partner_dev'`.

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/20260530_partner_api_keys.sql
git commit -m "feat: add partner_api_keys table with seed dev key"
```

---

### Task 2: API Key Guard

**Files:**
- Create: `apps/hopecard-donor-service/src/public/api-key.guard.ts`

- [ ] **Step 1: Create the guard**

```typescript
import {
  CanActivate, ExecutionContext, Injectable,
  UnauthorizedException, HttpException, HttpStatus,
} from '@nestjs/common';
import { supabase } from '@app/common/supabase-client';

interface PartnerKey {
  id: string;
  daily_limit: number;
}

// In-memory counter: Map<"keyId:YYYY-MM-DD", number>
const requestCounts = new Map<string, number>();

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-Api-Key header');
    }

    const { data, error } = await supabase
      .from('partner_api_keys')
      .select('id, daily_limit')
      .eq('key', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    const partner = data as PartnerKey;
    const bucket = `${partner.id}:${todayUtc()}`;
    const count = (requestCounts.get(bucket) ?? 0) + 1;

    if (count > partner.daily_limit) {
      throw new HttpException(
        `Daily request limit of ${partner.daily_limit} exceeded`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    requestCounts.set(bucket, count);
    return true;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p apps/hopecard-donor-service/tsconfig.app.json
```
Expected: no errors. If `tsconfig.app.json` doesn't exist, run `npx tsc --noEmit` from the repo root.

- [ ] **Step 3: Commit**

```bash
git add apps/hopecard-donor-service/src/public/api-key.guard.ts
git commit -m "feat: add ApiKeyGuard — validates X-Api-Key and enforces daily rate limit"
```

---

### Task 3: Public Service

**Files:**
- Create: `apps/hopecard-donor-service/src/public/public.service.ts`

Context: The existing `CampaignsService` at `apps/hopecard-donor-service/src/campaigns/campaigns.service.ts` uses `supabaseRequest` from `@app/common/supabase-helpers` and `getStorageUrl` from `@app/common/storage`. Use the same pattern here.

- [ ] **Step 1: Create the service**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { supabaseRequest } from '@app/common/supabase-helpers';
import { getStorageUrl } from '@app/common/storage';

const CAMPAIGN_SELECT =
  'id,title,description,category,target_amount,collected_amount,cover_image_key,status,end_date';

interface DbCampaignRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  target_amount: number;
  collected_amount: number;
  cover_image_key: string | null;
  status: string;
  end_date: string | null;
}

function formatCampaign(row: DbCampaignRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    category: row.category ?? 'other',
    target_amount: Number(row.target_amount),
    collected_amount: Number(row.collected_amount),
    progress_pct:
      row.target_amount > 0
        ? Math.min(
            100,
            Math.round(
              (Number(row.collected_amount) / Number(row.target_amount)) * 100,
            ),
          )
        : 0,
    cover_image_url: getStorageUrl('campaigns', row.cover_image_key ?? ''),
    end_date: row.end_date ?? null,
  };
}

@Injectable()
export class PublicService {
  async getCampaigns(category?: string, search?: string) {
    let query = `hc_campaigns?status=eq.active&select=${CAMPAIGN_SELECT}&order=created_at.desc`;
    if (category) query += `&category=eq.${encodeURIComponent(category)}`;
    if (search) query += `&title=ilike.${encodeURIComponent(`*${search}*`)}`;

    const rows = await supabaseRequest<DbCampaignRow[]>(query);
    return { campaigns: rows.map(formatCampaign) };
  }

  async getCampaign(id: string) {
    const rows = await supabaseRequest<DbCampaignRow[]>(
      `hc_campaigns?id=eq.${encodeURIComponent(id)}&status=eq.active&select=${CAMPAIGN_SELECT}&limit=1`,
    );
    if (rows.length === 0) throw new NotFoundException('Campaign not found');
    return { campaign: formatCampaign(rows[0]) };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/hopecard-donor-service/src/public/public.service.ts
git commit -m "feat: add PublicService — read-only campaign queries for partner API"
```

---

### Task 4: Public Controller

**Files:**
- Create: `apps/hopecard-donor-service/src/public/public.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { PublicService } from './public.service';

@UseGuards(ApiKeyGuard)
@Controller('hopecard/public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  /**
   * GET /api/v1/hopecard/public/campaigns
   * Query params: category (optional), search (optional)
   */
  @Get('campaigns')
  getCampaigns(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.publicService.getCampaigns(category, search);
  }

  /**
   * GET /api/v1/hopecard/public/campaigns/:id
   */
  @Get('campaigns/:id')
  getCampaign(@Param('id') id: string) {
    return this.publicService.getCampaign(id);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/hopecard-donor-service/src/public/public.controller.ts
git commit -m "feat: add PublicController — GET /hopecard/public/campaigns and /:id"
```

---

### Task 5: Public Module + wire into app

**Files:**
- Create: `apps/hopecard-donor-service/src/public/public.module.ts`
- Modify: `apps/hopecard-donor-service/src/donor-service.module.ts`

- [ ] **Step 1: Create the module**

```typescript
import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  controllers: [PublicController],
  providers: [ApiKeyGuard, PublicService],
})
export class PublicModule {}
```

- [ ] **Step 2: Register it in `donor-service.module.ts`**

Add `PublicModule` to the imports array. Read the file first to confirm the current content, then add the import statement and the module to the array:

```typescript
import { PublicModule } from './public/public.module';
```

Add `PublicModule` to the `imports: [...]` array alongside the existing modules.

- [ ] **Step 3: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/hopecard-donor-service/src/public/public.module.ts apps/hopecard-donor-service/src/donor-service.module.ts
git commit -m "feat: register PublicModule in donor service — partner API is now live"
```

---

### Task 6: Smoke test the endpoints manually

**Files:** none (verification only)

- [ ] **Step 1: Start the donor service**

```bash
npm run start:hopecard-donor-service:dev
```
Wait until "HopecardDonorService is running" appears in the logs.

- [ ] **Step 2: Test with a valid key — list campaigns**

```bash
curl -s -H "X-Api-Key: pk_test_hopecard_partner_dev" \
  http://localhost:3100/api/v1/hopecard/public/campaigns | head -c 500
```
Expected: JSON with `{ "campaigns": [...] }`. Status 200.

(Note: port may differ — check `HOPECARD_DONOR_PORT` in `.env` or the startup log.)

- [ ] **Step 3: Test with a valid key — single campaign**

Take any `id` from the list above and run:
```bash
curl -s -H "X-Api-Key: pk_test_hopecard_partner_dev" \
  http://localhost:3100/api/v1/hopecard/public/campaigns/<id>
```
Expected: JSON with `{ "campaign": { ... } }`. Status 200.

- [ ] **Step 4: Test with no key**

```bash
curl -s http://localhost:3100/api/v1/hopecard/public/campaigns
```
Expected: `{ "statusCode": 401, "message": "Missing X-Api-Key header" }` or similar 401.

- [ ] **Step 5: Test with an invalid key**

```bash
curl -s -H "X-Api-Key: pk_fake_key" \
  http://localhost:3100/api/v1/hopecard/public/campaigns
```
Expected: 401 with "Invalid or inactive API key".

- [ ] **Step 6: Test category filter**

```bash
curl -s -H "X-Api-Key: pk_test_hopecard_partner_dev" \
  "http://localhost:3100/api/v1/hopecard/public/campaigns?category=health"
```
Expected: 200, campaigns array filtered to `category: "health"` (may be empty if none exist).

- [ ] **Step 7: Commit a note in the README or APIGuide.md documenting the endpoint**

If `APIGuide.md` exists at the repo root, add a section. Otherwise skip this step. The entry should look like:

```markdown
## Partner Public API

**Base URL:** `GET /api/v1/hopecard/public/campaigns`

**Auth:** `X-Api-Key: <your-key>` header required.

**Endpoints:**
- `GET /campaigns?category=<cat>&search=<term>` — list active campaigns
- `GET /campaigns/:id` — single campaign by ID

**Response fields:** `id`, `title`, `description`, `category`, `target_amount`, `collected_amount`, `progress_pct`, `cover_image_url`, `end_date`

**Rate limit:** configurable per key (default 1000 req/day). Exceeding returns HTTP 429.

**Key management:** insert a row into `partner_api_keys` in Supabase. Set `is_active = false` to revoke instantly.
```

---

## Self-Review

**Spec coverage:**
- ✅ `partner_api_keys` table with `key`, `partner_name`, `is_active`, `daily_limit`, `allowed_origin` — Task 1
- ✅ `X-Api-Key` header validation — Task 2 (`ApiKeyGuard`)
- ✅ Per-key daily rate limit → HTTP 429 — Task 2
- ✅ Instant revocation via `is_active = false` — Task 2 (guard checks `is_active`)
- ✅ `GET /campaigns` with category + search filters — Tasks 3 & 4
- ✅ `GET /campaigns/:id` — Tasks 3 & 4
- ✅ Read-only — no POST/PATCH/DELETE endpoints exposed
- ✅ Returns only safe public fields (no donor data, no wallet info, no internal transaction IDs) — Task 3 (`formatCampaign`)
- ✅ Wired into app module — Task 5
- ✅ Smoke-tested — Task 6

**Type consistency:**
- `formatCampaign(row: DbCampaignRow)` defined in Task 3, used only in Task 3
- `ApiKeyGuard` defined in Task 2, imported in Tasks 4 & 5
- `PublicService` defined in Task 3, imported in Tasks 4 & 5
- `PublicController` defined in Task 4, imported in Task 5

**No placeholders:** All code blocks are complete and directly usable.
