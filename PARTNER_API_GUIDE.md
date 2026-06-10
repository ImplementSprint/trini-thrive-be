# HopeCard Partner API Guide

This guide explains how to integrate HopeCard campaigns into your own website or application using the HopeCard Partner Public API.

---

## Overview

The Partner API gives your site read-only access to active HopeCard campaigns — titles, descriptions, funding progress, cover images, and more. You can display campaigns on your site however you like: a donation widget, a campaign feed, an impact showcase, etc.

**What you can do:**
- List all active campaigns (with optional category and search filters)
- Fetch a single campaign by ID

**What you cannot do:**
- Modify any campaign data
- Access donor information
- Process payments (those happen on the HopeCard platform)

---

## Getting an API Key

Contact the HopeCard team to request a partner API key. You will receive:

- A key in the format `pk_live_xxxxxxxxxxxxxxxx`
- Your assigned daily request limit (default: 1,000 requests/day)

Keep your key private — do not expose it in client-side JavaScript. Always make API calls from your **backend server**.

> **To revoke a key at any time**, contact HopeCard support or an administrator will set it inactive in the system.

---

## Base URL

```
https://api.hopecard.com/api/v1
```

> Replace with your actual deployed domain. For local development the base URL is `http://localhost:3100/api/v1` (confirm port with your HopeCard contact).

---

## Authentication

Every request must include your API key in the `X-Api-Key` header:

```
X-Api-Key: pk_live_your_key_here
```

Requests without a key, or with an invalid/inactive key, receive a `401 Unauthorized` response.

---

## Endpoints

### List Campaigns

```
GET /hopecard/public/campaigns
```

Returns all currently active campaigns, ordered by newest first.

**Query Parameters**

| Parameter  | Type   | Required | Description                                      |
|------------|--------|----------|--------------------------------------------------|
| `category` | string | No       | Filter by category (e.g. `health`, `education`)  |
| `search`   | string | No       | Search campaigns by title (case-insensitive)     |

**Example Request**

```bash
curl -H "X-Api-Key: pk_live_your_key_here" \
  "https://api.hopecard.com/api/v1/hopecard/public/campaigns"
```

**Example Response**

```json
{
  "campaigns": [
    {
      "id": "3f4a1b2c-...",
      "title": "Rural Mobile Health Units",
      "description": "Bringing critical diagnostic care and vaccines to underserved mountainous regions.",
      "category": "health",
      "target_amount": 50000,
      "collected_amount": 44800,
      "progress_pct": 90,
      "cover_image_url": "https://storage.hopecard.com/campaigns/rural-health.jpg",
      "end_date": "2026-08-01"
    },
    ...
  ]
}
```

---

### Get a Single Campaign

```
GET /hopecard/public/campaigns/:id
```

Returns a single active campaign by its ID.

**Path Parameters**

| Parameter | Type   | Required | Description     |
|-----------|--------|----------|-----------------|
| `id`      | string | Yes      | The campaign ID |

**Example Request**

```bash
curl -H "X-Api-Key: pk_live_your_key_here" \
  "https://api.hopecard.com/api/v1/hopecard/public/campaigns/3f4a1b2c-..."
```

**Example Response**

```json
{
  "campaign": {
    "id": "3f4a1b2c-...",
    "title": "Rural Mobile Health Units",
    "description": "Bringing critical diagnostic care and vaccines to underserved mountainous regions.",
    "category": "health",
    "target_amount": 50000,
    "collected_amount": 44800,
    "progress_pct": 90,
    "cover_image_url": "https://storage.hopecard.com/campaigns/rural-health.jpg",
    "end_date": "2026-08-01"
  }
}
```

Returns `404 Not Found` if the campaign does not exist or is no longer active.

---

## Response Fields

| Field               | Type           | Description                                                          |
|---------------------|----------------|----------------------------------------------------------------------|
| `id`                | string (UUID)  | Unique campaign identifier                                           |
| `title`             | string         | Campaign name                                                        |
| `description`       | string         | Full campaign description                                            |
| `category`          | string         | Category tag (e.g. `health`, `education`, `environment`, `disaster`) |
| `target_amount`     | number         | Fundraising goal in PHP (₱)                                          |
| `collected_amount`  | number         | Amount raised so far in PHP (₱)                                      |
| `progress_pct`      | number (0–100) | Percentage of goal reached, capped at 100                            |
| `cover_image_url`   | string \| null | URL of the campaign cover image, or `null` if none                   |
| `end_date`          | string \| null | ISO date the campaign ends (e.g. `"2026-08-01"`), or `null`          |

---

## Error Responses

| Status | Meaning                                      |
|--------|----------------------------------------------|
| `401`  | Missing, invalid, or inactive API key        |
| `404`  | Campaign not found or no longer active       |
| `429`  | Daily request limit exceeded                 |
| `500`  | Internal server error — contact HopeCard     |

**Error response format:**

```json
{
  "statusCode": 401,
  "message": "Invalid or inactive API key"
}
```

---

## Rate Limiting

Each API key has a configurable daily request limit (default: **1,000 requests per day**). The limit resets at **midnight UTC** each day.

When the limit is exceeded, the API returns:

```
HTTP 429 Too Many Requests
{
  "statusCode": 429,
  "message": "Daily request limit of 1000 exceeded"
}
```

To request a higher limit, contact the HopeCard team.

**Best practices to stay within limits:**
- Cache the campaign list on your server and refresh it periodically (e.g. every 10–15 minutes) rather than fetching on every page load.
- Use the `category` filter to only fetch what your page needs.

---

## Code Examples

### Node.js (fetch)

```javascript
const API_KEY = process.env.HOPECARD_API_KEY; // never hardcode
const BASE = 'https://api.hopecard.com/api/v1/hopecard/public';

async function getCampaigns(category) {
  const url = new URL(`${BASE}/campaigns`);
  if (category) url.searchParams.set('category', category);

  const res = await fetch(url.toString(), {
    headers: { 'X-Api-Key': API_KEY },
  });

  if (!res.ok) throw new Error(`HopeCard API error: ${res.status}`);
  return res.json(); // { campaigns: [...] }
}

async function getCampaign(id) {
  const res = await fetch(`${BASE}/campaigns/${id}`, {
    headers: { 'X-Api-Key': API_KEY },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HopeCard API error: ${res.status}`);
  return res.json(); // { campaign: {...} }
}
```

---

### Next.js (Server Component)

Make the API call server-side so your key is never exposed to the browser.

```tsx
// app/campaigns/page.tsx
const API_KEY = process.env.HOPECARD_API_KEY!;
const BASE = 'https://api.hopecard.com/api/v1/hopecard/public';

async function fetchCampaigns() {
  const res = await fetch(`${BASE}/campaigns`, {
    headers: { 'X-Api-Key': API_KEY },
    next: { revalidate: 600 }, // cache for 10 minutes
  });
  if (!res.ok) throw new Error('Failed to fetch campaigns');
  return res.json();
}

export default async function CampaignsPage() {
  const { campaigns } = await fetchCampaigns();

  return (
    <div>
      {campaigns.map((c) => (
        <div key={c.id}>
          <img src={c.cover_image_url} alt={c.title} />
          <h2>{c.title}</h2>
          <p>{c.description}</p>
          <progress value={c.progress_pct} max={100} />
          <span>₱{c.collected_amount.toLocaleString()} raised of ₱{c.target_amount.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
```

---

### PHP

```php
<?php
function getHopecardCampaigns(string $category = ''): array {
    $url = 'https://api.hopecard.com/api/v1/hopecard/public/campaigns';
    if ($category) $url .= '?category=' . urlencode($category);

    $opts = [
        'http' => [
            'header' => 'X-Api-Key: ' . $_ENV['HOPECARD_API_KEY'],
            'method' => 'GET',
        ],
    ];

    $context = stream_context_create($opts);
    $body = file_get_contents($url, false, $context);
    if ($body === false) throw new Exception('HopeCard API request failed');

    return json_decode($body, true)['campaigns'];
}
```

---

### Python (requests)

```python
import os
import requests

HOPECARD_API_KEY = os.environ['HOPECARD_API_KEY']
BASE = 'https://api.hopecard.com/api/v1/hopecard/public'

def get_campaigns(category=None, search=None):
    params = {}
    if category: params['category'] = category
    if search: params['search'] = search

    r = requests.get(
        f'{BASE}/campaigns',
        headers={'X-Api-Key': HOPECARD_API_KEY},
        params=params,
        timeout=10,
    )
    r.raise_for_status()
    return r.json()['campaigns']

def get_campaign(campaign_id):
    r = requests.get(
        f'{BASE}/campaigns/{campaign_id}',
        headers={'X-Api-Key': HOPECARD_API_KEY},
        timeout=10,
    )
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()['campaign']
```

---

## Caching Recommendation

To reduce API calls and improve your site's performance, cache the campaign list on your server:

```
Your server fetches from HopeCard API  →  stores in cache (10–15 min TTL)
Your visitors fetch from your cache    →  fast, no API key exposure
```

Popular options: Redis, Memcached, Next.js `revalidate`, or a simple in-memory store with a timestamp.

---

## Redirecting to HopeCard

The Partner API is read-only — donations are made on the HopeCard platform. To let your visitors donate, link them to the campaign on HopeCard using the campaign `id`:

```
https://hopecard.com/donor/home?campaign=<id>
```

> Confirm the exact deep-link URL format with your HopeCard contact, as it may vary by deployment.

---

## FAQ

**Can I show campaigns from only one category?**
Yes — use the `?category=health` query parameter. Available categories include `health`, `education`, `environment`, `disaster`, and others as added by the HopeCard team.

**What happens if a campaign ends or is deactivated?**
It will no longer appear in the list endpoint, and the single-campaign endpoint will return `404`. Build your UI to handle a 404 gracefully.

**Can I use the API key in a browser (client-side)?**
No. Your API key must be kept secret. Always call the API from your backend and serve the data to your frontend from there.

**How do I get a higher rate limit?**
Contact the HopeCard team. Limits are configurable per key.

**Can I embed a HopeCard campaign widget directly?**
Not currently via the API — you are responsible for rendering the campaign data in your own UI. If you need a drop-in iframe widget, ask the HopeCard team.

---

## Contact

For API key requests, limit increases, or integration support, contact the HopeCard team at:

- Email: `support@hopecard.com`
- Or reach out through your existing HopeCard partnership contact.
