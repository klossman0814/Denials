# Performance Optimization — Design Spec

## Overview

Optimize the Insurance Denials Management System to remain responsive when processing large volumes of EDI 835/837 files. Seven workstreams address N+1 DB patterns, over-fetching, missing indexes, synchronous processing, dashboard caching, search debouncing, and upload list pagination.

---

## 1. Upload Processing: Bulk Insert (N+1 Fix)

### Problem

`_process837` and `_process835` in `backend/src/services/upload.service.js` use individual `await Model.create()` inside for-loops. For a file with 500 claims × 2 lines = 1500+ queries, or 400 remittances × 3 denial reasons × 2 service lines = 3200+ queries.

### Solution

Replace sequential `create()` calls with `Model.bulkCreate()` for batch operations:

**`_process837`:**
- Collect all claims into an array → `Claim.bulkCreate(claims)` in one query
- Collect all claim lines into an array → `ClaimLine.bulkCreate(lines)` in one query
- The `file_id` and `claim_id` FK assignments work because `bulkCreate` returns created rows with IDs

**`_process835`:**
- `RemittanceFile.create()` stays single (one per file)
- For remittances: collect all remittances → `Remittance.bulkCreate(remittances)`
- For denial_reasons: collect all claim-level denial reasons per batch → bulk insert
- For service_lines: collect all lines per batch → bulk insert
- For line-level denial reasons: collect per batch → bulk insert

**Claim matching constraint:** The `_matchClaim()` lookup per remittance must still happen sequentially (it needs the claim FK). However, once we have the matched `claim_id`, the rest (denial_reasons, service_lines) can be batched.

### Changes

| File | Change |
|------|--------|
| `backend/src/services/upload.service.js` | Rewrite `_process837`, `_process835` to use `bulkCreate` |
| `backend/src/services/upload.service.js` | Map claim/remittance IDs back from bulk results for FK references |

### Risk

Low. `bulkCreate` is a core Sequelize feature. The main concern is preserving FK relationships — handled by mapping the returned IDs from each `bulkCreate` call.

---

## 2. List Endpoint Over-Fetching

### 2a. Claims List (`GET /api/claims`)

**Problem:** `claims.controller.js` includes `ClaimLine` (all service lines for every claim) and `Remittance` (all remittances for every claim) in the list endpoint — but the table only shows 7 fields and a total paid sum.

**Solution:** Strip `ClaimLine` from the include entirely (not shown on list). Replace the `Remittance` include with a subquery to compute `total_paid`:

```js
const { rows, count } = await Claim.findAndCountAll({
  where,
  attributes: {
    include: [
      [
        literal(`(
          SELECT COALESCE(SUM("Remittances"."total_paid"), 0)
          FROM "remittances" AS "Remittances"
          WHERE "Remittances"."claim_id" = "Claim"."id"
        )`),
        'total_paid',
      ],
    ],
  },
  order: [['created_at', 'DESC']],
  limit: parseInt(limit),
  offset,
});
```

This avoids loading all related rows when only a sum is needed.

### 2b. Denials List (`GET /api/denials`)

**Problem:** `denials.controller.js` includes `Claim`, `ClaimLine`, `Remittance`, and `RemittanceLine` for each denial row. The `subQuery: false` breaks pagination counting. Additionally, the summary query and top-code query run on every page load (including pages 2+).

**Solution:**
1. Replace `subQuery: false` with a controlled subquery approach — only join `Claim` (required for payer/status filters), drop `ClaimLine`, `Remittance`, `RemittanceLine` includes
2. Pull `procedure_code` via a simple subquery on the denial reason's remittance_line or claim_line FK instead of a full join
3. Move the summary/top-code queries to render only on page 1, or cache them

### Changes

| File | Change |
|------|--------|
| `backend/src/controllers/claims.controller.js` | Replace `ClaimLine`+`Remittance` includes with subquery for `total_paid` |
| `backend/src/controllers/denials.controller.js` | Strip `ClaimLine`, `Remittance`, `RemittanceLine` includes; fix `subQuery`; add page-1-only guard for summary queries |

### Risk

Low. Subqueries are standard SQL. The existing API response shapes stay identical.

---

## 3. Database Indexes

### Problem

No explicit indexes on frequently-queried columns. As row counts grow, `ILIKE` searches and JOINs do full sequential scans.

### Solution

Add indexes to `backend/src/models/` via Sequelize's `indexes` option on each model definition, **plus** a raw migration SQL file that gets executed on startup for compound indexes.

#### Indexes to add

| Model | Columns | Type | Rationale |
|-------|---------|------|-----------|
| `Claim` | `claim_id` | B-tree | Search, match against 835 payer_claim_id |
| `Claim` | `payer_name` | B-tree | Filter, ILIKE search |
| `Claim` | `status` | B-tree | Filter |
| `Claim` | `created_at` | B-tree | Sort order |
| `Claim` | `(status, created_at)` | Composite | Most common sort+filter |
| `Claim` | `patient_last_name`, `patient_first_name` | B-tree | Search |
| `UploadedFile` | `content_hash` | B-tree | Duplicate detection |
| `UploadedFile` | `file_type`, `status` | Composite | File listing filters |
| `DenialReason` | `denial_code` | B-tree | Search, group-by |
| `DenialReason` | `claim_id` | B-tree | FK join |
| `DenialReason` | `remittance_id` | B-tree | FK join |
| `Remittance` | `claim_id` | B-tree | FK join |
| `Remittance` | `remittance_file_id` | B-tree | FK join |
| `RemittanceFile` | `payer_name` | B-tree | Search |

### Implementation

Add `indexes` property to each model define call:

```js
// Example for Claim model
const Claim = sequelize.define('Claim', { ... }, {
  tableName: 'claims',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['claim_id'] },
    { fields: ['payer_name'] },
    { fields: ['status'] },
    { fields: ['created_at'] },
    { fields: ['status', 'created_at'] },
    { fields: ['patient_last_name'] },
    { fields: ['patient_first_name'] },
  ],
});
```

### ILIKE + Leading Wildcard Caveat

Standard B-tree indexes do **not** speed up `ILIKE '%search%'` queries (leading wildcard). For the most common case — searching across `patient_first_name`, `patient_last_name`, `claim_id` — the B-tree index on individual columns won't help the `%search%` pattern. To fully optimize these, a **pg_trgm** (trigram) index is needed:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_claims_patient_trgm ON "claims" USING gin ("patient_first_name" gin_trgm_ops, "patient_last_name" gin_trgm_ops);
CREATE INDEX idx_claims_claim_id_trgm ON "claims" USING gin ("claim_id" gin_trgm_ops);
```

This is a **stretch goal** — implement if `ILIKE` searches remain slow after the other index changes. Not including in the initial implementation to keep scope bounded.

### Risk

Minimal. Standard B-tree indexes add negligible write overhead for the write volume here. Sequelize creates these on `sync()`.

---

## 4. Async File Processing

### Problem

`upload.controller.js` calls `uploadService.processFile()` synchronously inside the HTTP handler. A large file can block for minutes, timing out the request and blocking the Node.js event loop.

### Solution

Use **Bull** (popular, lightweight job queue backed by Redis) to offload processing:

1. On file upload, store the file, create an `UploadedFile` record with `status: 'queued'`, enqueue a Bull job, return `202 Accepted` with the file ID
2. A Bull worker processes the job asynchronously: parse → bulk insert → update status to `'parsed'` or `'error'`
3. Frontend polls `GET /upload/files` or uses the existing re-fetch mechanism to show status updates

### Architecture

```
HTTP Upload → save file → create UploadedFile(queued) → enqueue Bull job → return 202
                                                                    ↓
                                                            Bull Worker (separate process)
                                                                    ↓
                                                            parse EDI → bulkCreate → update status
```

### Changes

| File | Change |
|------|--------|
| `backend/package.json` | Add `bull` dependency |
| `docker-compose.yml` | Add Redis service (`redis:7-alpine`) |
| `backend/src/config/env.js` | Add `redis.url` config |
| `backend/src/queue/ediQueue.js` | New file: Bull queue setup |
| `backend/src/queue/ediWorker.js` | New file: job processor |
| `backend/src/controllers/upload.controller.js` | Return 202, enqueue job instead of waiting |
| `backend/src/services/upload.service.js` | No change (already stateless) |
| `backend/src/server.js` | Start worker on boot |
| `backend/src/config/database.js` | No change |

### Worker Detail

The worker receives `filePath` and `fileType`, calls the existing `uploadService.processFile()`, and updates the `UploadedFile` record status. On error, sets `status: 'error'` and stores the error message.

### Frontend

The Upload page already calls `uploadApi.listFiles()` after upload and shows `StatusBadge` for each file — so `queued` / `parsed` / `error` states display naturally. No frontend changes needed beyond possibly adding a polling interval for in-progress files.

### Risk

Low. Bull is mature (11k+ stars, maintained). Redis is already the standard queue backend. The only operational change is adding Redis to the Docker compose stack.

---

## 5. Dashboard Query Caching

### Problem

`dashboard.service.js` runs 5+ aggregation queries (COUNT, SUM, GROUP BY) across the entire database on every page load. With large datasets, these become slow.

### Solution

Add an in-memory cache layer with TTL-based invalidation:

1. Create a simple `QueryCache` class with `get(key)`, `set(key, value, ttlMs)`, `invalidate(pattern)`
2. Wrap each dashboard method (getSummary, getDenialReasons, getTrends, getPayerBreakdown, getAging) to cache its result for **5 minutes**
3. Invalidate all dashboard caches when a file finishes processing (in the upload worker's completion handler)

### Implementation Sketch

```js
// backend/src/utils/queryCache.js
class QueryCache {
  constructor() { this._store = new Map(); }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this._store.delete(key); return null; }
    return entry.value;
  }

  set(key, value, ttlMs = 300000) {
    this._store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(pattern) {
    for (const key of this._store.keys()) {
      if (key.startsWith(pattern)) this._store.delete(key);
    }
  }
}

module.exports = new QueryCache();
```

```js
// In dashboard.service.js
const cache = require('../utils/queryCache');

async getSummary() {
  const cached = cache.get('dashboard:summary');
  if (cached) return cached;
  const result = await this._computeSummary();
  cache.set('dashboard:summary', result);
  return result;
}
```

```js
// In upload worker, after successful processing:
const cache = require('../utils/queryCache');
cache.invalidate('dashboard:');
```

### Changes

| File | Change |
|------|--------|
| `backend/src/utils/queryCache.js` | New file |
| `backend/src/services/dashboard.service.js` | Wrap each method with cache read/write |
| `backend/src/services/upload.service.js` | Invalidate dashboard cache on successful parse |

### Risk

Low. Only risk is stale data — 5-minute TTL bounds it. Cache clears on new uploads. For a denials management system, near-real-time is sufficient.

---

## 6. Frontend Search Debouncing

### Problem

Claims, Remittances, and Denials pages fire API calls on every `onChange` keystroke. A 5-character search fires 5 API calls.

### Solution

Add a `useDebounce` hook:

```js
// frontend/src/hooks/useDebounce.js
import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

Then in each page, create a debounced copy of the search state and use that for the API call.

**Handling multiple filter inputs** (Denials page): debounce applies to text-based inputs (`search`, `denialCode`, `payer`) — those fire on every keystroke. The `status` dropdown fires immediately on change (single click, no spamming). To debounce multiple values together, combine them into one effect dependency:

```js
const [search, setSearch] = useState('');
const [denialCode, setDenialCode] = useState('');
const [payer, setPayer] = useState('');
const [status, setStatus] = useState('');

const debouncedSearch = useDebounce(search, 300);
const debouncedDenialCode = useDebounce(denialCode, 300);
const debouncedPayer = useDebounce(payer, 300);

// status is NOT debounced (fires immediately)
useEffect(() => {
  denialsApi.list({ page, debouncedSearch, debouncedDenialCode, debouncedPayer, status });
}, [page, debouncedSearch, debouncedDenialCode, debouncedPayer, status]);
```

### Changes

| File | Change |
|------|--------|
| `frontend/src/hooks/useDebounce.js` | New file |
| `frontend/src/pages/Claims.jsx` | Use `useDebounce` for search state |
| `frontend/src/pages/Remittances.jsx` | Use `useDebounce` for search state |
| `frontend/src/pages/Denials.jsx` | Use `useDebounce` for search/denialCode/payer/status |

### Risk

Minimal. Standard React pattern.

---

## 7. Upload List Pagination

### Problem

`upload.controller.js` `listFiles` hardcodes `limit: 100` with no pagination support. Frontend gets all files at once.

### Solution

Add standard `page`/`limit` query params (matching claims/remittances/denials patterns), use `findAndCountAll` instead of `findAll`, and add pagination controls to the Upload page table.

### Changes

| File | Change |
|------|--------|
| `backend/src/controllers/upload.controller.js` | Switch to `findAndCountAll` with `page`/`limit` params |
| `frontend/src/pages/Upload.jsx` | Add pagination state + controls (same pattern as Claims/Denials) |
| `frontend/src/services/upload.api.js` | Accept `page`/`limit` params |

---

## 8. Files Summary

### New Files (4)

| # | File | Purpose |
|---|------|---------|
| 1 | `backend/src/utils/queryCache.js` | Simple TTL-based in-memory cache |
| 2 | `backend/src/queue/ediQueue.js` | Bull queue setup for EDI processing |
| 3 | `backend/src/queue/ediWorker.js` | Bull worker for async EDI processing |
| 4 | `frontend/src/hooks/useDebounce.js` | Debounce hook for search inputs |

### Modified Files (12)

| # | File | Change |
|---|------|--------|
| 1 | `backend/src/services/upload.service.js` | `bulkCreate` for batch inserts |
| 2 | `backend/src/controllers/claims.controller.js` | Subquery for total_paid, drop ClaimLine |
| 3 | `backend/src/controllers/denials.controller.js` | Strip unnecessary includes, fix subQuery, page-1 summary guard |
| 4 | `backend/src/controllers/upload.controller.js` | Async job enqueue, paginated list |
| 5 | `backend/src/services/dashboard.service.js` | Cache wrap |
| 6 | `backend/src/models/Claim.js` | Add indexes |
| 7 | `backend/src/models/DenialReason.js` | Add indexes |
| 8 | `backend/src/models/Remittance.js` | Add indexes |
| 9 | `backend/src/models/RemittanceFile.js` | Add indexes |
| 10 | `backend/src/models/UploadedFile.js` | Add indexes |
| 11 | `backend/package.json` | Add `bull` |
| 12 | `frontend/src/pages/Claims.jsx` | Debounce search |
| 13 | `frontend/src/pages/Remittances.jsx` | Debounce search |
| 14 | `frontend/src/pages/Denials.jsx` | Debounce search filters |
| 15 | `frontend/src/pages/Upload.jsx` | Pagination controls |
| 16 | `frontend/src/services/upload.api.js` | Accept pagination params |
| 17 | `backend/src/config/env.js` | Add `redis.url` |
| 18 | `backend/src/server.js` | Start Bull worker |

### What This Does NOT Change

- All existing API response shapes remain identical
- No database migrations (indexes added via model definitions, created on `sync()`)
- No UI layout changes (same tables, same controls, same navigation)
- No new dependencies beyond `bull` (npm) and Redis (Docker)

---

## 9. Order of Implementation

Workstreams are ordered by dependency, then grouped for parallel execution:

| Step | Workstream | Dependencies |
|------|------------|-------------|
| 1 | DB Indexes (models) | None |
| 2 | Bulk Insert (upload.service) | None |
| 3 | List Over-Fetching (controller changes) | None |
| 4 | Search Debouncing (frontend hooks) | None |
| 5 | Upload List Pagination | None |
| 6 | Dashboard Caching (queryCache + dashboard.service) | None |
| 7 | Async File Processing (Bull queue + Redis) | Depends on bulk insert (step 2) for clean separation |

Steps 1–6 are independent and can be implemented in parallel. Step 7 depends on step 2.

---

## 10. Rollback Plan

Per workstream:

- **Indexes:** `DROP INDEX IF EXISTS` in a rollback migration
- **Bulk insert:** Revert `upload.service.js` to previous version
- **Controller changes:** Revert to previous version
- **Debounce:** Remove hook usage, revert to direct state
- **Pagination:** Revert controller and frontend
- **Dashboard caching:** Remove `queryCache.js`, revert service
- **Async processing:** Stop worker, revert controller to synchronous processing, remove Redis from docker-compose
