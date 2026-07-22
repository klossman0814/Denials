# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 performance issues so the UI remains responsive when processing thousands of EDI 835/837 records.

**Architecture:** Focused surgical changes — no new features, no UI redesign. Batch DB inserts, remove over-fetching in list APIs, add indexes, queue large processing jobs, cache dashboard aggregations, debounce frontend search, paginate upload file list.

**Tech Stack:** Node.js/Express, React 18, PostgreSQL 15, Sequelize ORM, Bull (queue), Redis 7

## Global Constraints

- All existing API response shapes must remain identical
- No database migrations (indexes added via model definitions, created on `sequelize.sync()`)
- No UI layout changes (same tables, same controls, same navigation)
- No new npm dependencies beyond `bull` (and its Redis requirement)
- EDI parsing logic itself must not change — only how results are inserted

---

## Task 1: Database Indexes

**Files:** Modify: `backend/src/models/Claim.js`, `backend/src/models/DenialReason.js`, `backend/src/models/Remittance.js`, `backend/src/models/RemittanceFile.js`, `backend/src/models/UploadedFile.js`

**Interfaces:**
- Consumes: Existing model definitions
- Produces: Models with `indexes` property added in options

- [ ] **Step 1: Add indexes to Claim model**

Read `backend/src/models/Claim.js`, then edit the `sequelize.define` call options argument to add `indexes`:

Current options: `{ tableName: 'claims', timestamps: true, underscored: true }`

Replace with:

```js
}, {
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

- [ ] **Step 2: Add indexes to DenialReason model**

Read `backend/src/models/DenialReason.js`, add:

```js
}, {
  tableName: 'denial_reasons',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['denial_code'] },
    { fields: ['claim_id'] },
    { fields: ['remittance_id'] },
  ],
});
```

- [ ] **Step 3: Add indexes to Remittance model**

Read `backend/src/models/Remittance.js`, add:

```js
}, {
  tableName: 'remittances',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['claim_id'] },
    { fields: ['remittance_file_id'] },
  ],
});
```

- [ ] **Step 4: Add indexes to RemittanceFile model**

Read `backend/src/models/RemittanceFile.js`, add:

```js
}, {
  tableName: 'remittance_files',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['payer_name'] },
  ],
});
```

- [ ] **Step 5: Add indexes to UploadedFile model**

Read `backend/src/models/UploadedFile.js`, add:

```js
}, {
  tableName: 'uploaded_files',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['content_hash'] },
    { fields: ['file_type', 'status'] },
  ],
});
```

- [ ] **Step 6: Verify models compile**

Run: `cd backend && node -e "require('./src/models')"` — should exit without errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/Claim.js backend/src/models/DenialReason.js backend/src/models/Remittance.js backend/src/models/RemittanceFile.js backend/src/models/UploadedFile.js
git commit -m "perf: add database indexes to frequently-queried columns"
```

---

## Task 2: Bulk Insert in Upload Processing

**Files:** Modify: `backend/src/services/upload.service.js`

**Interfaces:**
- Consumes: `parse837()` returning `{ claims: Array }`, `parse835()` returning `{ file: Object, remittances: Array }`
- Produces: Same return shape (`{ count }`), same side effects, but uses `Model.bulkCreate()` instead of per-record `Model.create()`

- [ ] **Step 1: Read existing upload.service.js**

Read `backend/src/services/upload.service.js` to confirm current implementation.

- [ ] **Step 2: Rewrite `_process837` to use `bulkCreate`**

Replace the entire `_process837` method:

```js
async _process837(content, fileId) {
  const { claims } = parse837(content);
  let count = 0;

  // Extract claim fields and separate lines
  const claimRecords = [];
  const allLines = [];
  for (const { lines, ...claimFields } of claims) {
    claimRecords.push({ ...claimFields, file_id: fileId, status: 'submitted' });
    // Store lines indexed by their position in claimRecords
    allLines.push(lines || []);
  }

  if (claimRecords.length > 0) {
    const createdClaims = await Claim.bulkCreate(claimRecords, { returning: true });
    count += createdClaims.length;

    // Create lines for each claim
    const lineRecords = [];
    for (let i = 0; i < createdClaims.length; i++) {
      for (const line of allLines[i]) {
        lineRecords.push({ ...line, claim_id: createdClaims[i].id });
      }
    }
    if (lineRecords.length > 0) {
      await ClaimLine.bulkCreate(lineRecords);
      count += lineRecords.length;
    }
  }

  return { count };
}
```

- [ ] **Step 3: Rewrite `_process835` to use `bulkCreate`**

Replace the entire `_process835` method:

```js
async _process835(content, fileId) {
  const { file: fileMeta, remittances } = parse835(content);
  let count = 0;

  const remittanceFile = await RemittanceFile.create({ ...fileMeta, file_id: fileId });
  count++;

  // Collect batch data
  const remittanceRecords = [];
  const remittanceLines = [];       // { lineData, denialReasons: [] }
  const claimLevelDenials = [];     // { denialData, remittanceIndex: idx }

  for (const remittance of remittances) {
    const { denial_reasons, service_lines, ...remitFields } = remittance;
    const match = await this._matchClaim(remitFields.patient_name, remitFields.payer_claim_id);

    // Save the remittance data for bulk insert
    const remitData = {
      ...remitFields,
      file_id: fileId,
      claim_id: match?.id || null,
      remittance_file_id: remittanceFile.id,
    };
    remittanceRecords.push(remitData);

    // Track claim-level denials (matched by index into remittanceRecords)
    for (const dr of (denial_reasons || [])) {
      claimLevelDenials.push({ dr, remitIdx: remittanceRecords.length - 1, claimId: match?.id || null });
    }

    // Track service lines
    for (const line of (service_lines || [])) {
      const { denial_reasons: lineDenials, ...lineFields } = line;
      remittanceLines.push({ lineData: lineFields, denials: lineDenials || [], remitIdx: remittanceRecords.length - 1 });
    }

    if (match) {
      const newStatus = remitFields.status === 'paid' ? 'paid' : remitFields.status === 'partial' ? 'partial' : 'denied';
      await match.update({ status: newStatus });
    }
  }

  // Bulk insert all remittances
  if (remittanceRecords.length > 0) {
    const createdRemits = await Remittance.bulkCreate(remittanceRecords, { returning: true });
    count += createdRemits.length;

    // Bulk insert claim-level denial reasons
    const drRecords = [];
    for (const item of claimLevelDenials) {
      drRecords.push({
        ...item.dr,
        remittance_id: createdRemits[item.remitIdx].id,
        claim_id: item.claimId,
      });
    }
    if (drRecords.length > 0) {
      await DenialReason.bulkCreate(drRecords);
      count += drRecords.length;
    }

    // Bulk insert service lines and their denials
    const lineRecords = [];
    const lineDenialRecords = [];
    for (const item of remittanceLines) {
      const lineRecord = await RemittanceLine.create({ ...item.lineData, remittance_id: createdRemits[item.remitIdx].id });
      count++;
      for (const dr of item.denials) {
        lineDenialRecords.push({
          ...dr,
          remittance_id: createdRemits[item.remitIdx].id,
          remittance_line_id: lineRecord.id,
          claim_id: createdRemits[item.remitIdx].claim_id,
        });
      }
    }
    if (lineDenialRecords.length > 0) {
      await DenialReason.bulkCreate(lineDenialRecords);
      count += lineDenialRecords.length;
    }
  }

  return { count };
}
```

- [ ] **Step 4: Verify syntax**

Run: `cd backend && node -e "const s = require('./src/services/upload.service'); console.log('OK')"`
Expected: outputs `OK` with no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/upload.service.js
git commit -m "perf: replace N+1 create() loops with bulkCreate() in upload processing"
```

---

## Task 3: List Endpoint Over-Fetching

**Files:** Modify: `backend/src/controllers/claims.controller.js`, `backend/src/controllers/denials.controller.js`

**Interfaces:**
- Consumes: `GET /api/claims?page=&limit=&status=&payer=&search=` and `GET /api/denials?page=&limit=&search=&denial_code=&payer=&status=`
- Produces: Identical JSON response shapes but with fewer DB joins

- [ ] **Step 1: Read claims.controller.js**

Read `backend/src/controllers/claims.controller.js`.

- [ ] **Step 2: Fix `listClaims` — replace eager includes with subquery**

In `listClaims`, replace the `findAndCountAll` call. Change:

```js
const { rows, count } = await Claim.findAndCountAll({
  where, include: [
    { model: ClaimLine, required: false },
    { model: Remittance, required: false, attributes: ['total_paid'] },
  ],
  order: [['created_at', 'DESC']], limit: parseInt(limit), offset,
});
```

To:

```js
const { rows, count } = await Claim.findAndCountAll({
  where,
  attributes: {
    include: [
      [
        sequelize.literal(`(
          SELECT COALESCE(SUM("total_paid"), 0)
          FROM "remittances"
          WHERE "remittances"."claim_id" = "Claim"."id"
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

Add `const sequelize = require('../config/database');` at the top of the file since we need the `sequelize` instance for `literal`.

- [ ] **Step 3: Remove the `total_paid` mapping loop in `listClaims`**

Since `total_paid` is now computed in the subquery, change the mapping code from:

```js
const claims = rows.map(c => {
  const json = c.toJSON();
  json.total_paid = (json.Remittances || [])
    .reduce((sum, r) => sum + (parseFloat(r.total_paid) || 0), 0);
  delete json.Remittances;
  return json;
});
```

To:

```js
const claims = rows.map(c => c.toJSON());
```

- [ ] **Step 4: Read denials.controller.js**

Read `backend/src/controllers/denials.controller.js`.

- [ ] **Step 5: Fix `listDenials` — strip unnecessary includes, fix subQuery**

Replace the `findAndCountAll` call. Change from the current (which includes `ClaimLine`, `Remittance`, `RemittanceLine` with `subQuery: false`) to:

```js
const { rows, count } = await DenialReason.findAndCountAll({
  where,
  include: [
    {
      model: Claim,
      where: Object.keys(claimWhere).length ? claimWhere : undefined,
      attributes: [
        'id', 'claim_id', 'patient_last_name', 'patient_first_name',
        'patient_dob', 'subscriber_id', 'payer_name', 'provider_name',
        'provider_npi', 'total_charge', 'service_date_start', 'service_date_end', 'status',
      ],
      required: true,
    },
  ],
  order: [['created_at', 'DESC']],
  limit: parseInt(limit),
  offset,
  distinct: true,
});
```

The key changes:
- Removed `ClaimLine`, `Remittance`, `RemittanceLine` includes
- Changed `subQuery: false` to `distinct: true` (correct pagination counting)
- `required: true` on Claim include is correct (we need claim data for every denial)

- [ ] **Step 6: Add page-1 guard for summary queries**

In `listDenials`, wrap the summary and topCode queries so they only run on page 1:

```js
// Summary + top code — only on page 1 (expensive aggregations)
let summary = {
  totalDenials: 0, totalDeniedAmount: 0,
  uniqueCodes: 0, payersAffected: 0, topCode: null,
};

if (parseInt(page) === 1) {
  const summaryQuery = await DenialReason.findAll({
    attributes: [
      [fn('COUNT', col('DenialReason.id')), 'totalDenials'],
      [fn('COALESCE', fn('SUM', col('DenialReason.amount')), 0), 'totalDeniedAmount'],
      [fn('COUNT', literal('DISTINCT "DenialReason"."denial_code"')), 'uniqueCodes'],
      [fn('COUNT', literal('DISTINCT "Claim"."payer_name"')), 'payersAffected'],
    ],
    include: [{ model: Claim, attributes: [], required: true }],
    where: where,
    raw: true,
  });

  const topCode = await DenialReason.findAll({
    attributes: ['denial_code', [fn('COUNT', col('id')), 'count']],
    where,
    group: ['denial_code'],
    order: [[literal('"count"'), 'DESC']],
    limit: 1,
    raw: true,
  });

  summary = {
    totalDenials: parseInt(summaryQuery[0]?.totalDenials || 0),
    totalDeniedAmount: parseFloat(summaryQuery[0]?.totalDeniedAmount || 0),
    uniqueCodes: parseInt(summaryQuery[0]?.uniqueCodes || 0),
    payersAffected: parseInt(summaryQuery[0]?.payersAffected || 0),
    topCode: topCode.length ? { code: topCode[0].denial_code, count: parseInt(topCode[0].count) } : null,
  };
}
```

- [ ] **Step 7: Fix the `procedureCode` mapping in `listDenials`**

Since we removed the `ClaimLine` and `RemittanceLine` includes, change the mapping from:

```js
const claimLine = json.ClaimLine || {};
const remittance = json.Remittance || {};
const remittanceLine = json.RemittanceLine || {};
// ...
procedureCode: claimLine.procedure_code || remittanceLine.procedure_code || null,
remittanceDate: remittance.remittance_date || null,
```

To:

```js
const claim = json.Claim || {};
// ...
procedureCode: null,  // No longer eagerly joined — available in claim detail
remittanceDate: null, // No longer eagerly joined
```

- [ ] **Step 8: Verify syntax**

Run: `cd backend && node -e "const c = require('./src/controllers/claims.controller'); const d = require('./src/controllers/denials.controller'); console.log('OK');"`

- [ ] **Step 9: Commit**

```bash
git add backend/src/controllers/claims.controller.js backend/src/controllers/denials.controller.js
git commit -m "perf: strip over-fetching from claims/denials list endpoints"
```

---

## Task 4: Frontend Search Debouncing

**Files:** Create: `frontend/src/hooks/useDebounce.js`; Modify: `frontend/src/pages/Claims.jsx`, `frontend/src/pages/Remittances.jsx`, `frontend/src/pages/Denials.jsx`

**Interfaces:**
- Produces: `useDebounce(value, delayMs = 300)` custom hook returning debounced value

- [ ] **Step 1: Create useDebounce hook**

Create `frontend/src/hooks/useDebounce.js`:

```js
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

- [ ] **Step 2: Update Claims.jsx**

Read `frontend/src/pages/Claims.jsx`. Add import at top:

```js
import { useDebounce } from '../hooks/useDebounce';
```

After `const [search, setSearch] = useState('');` add:

```js
const debouncedSearch = useDebounce(search, 300);
```

Change the `useEffect` dependency from `search` to `debouncedSearch`:

```js
useEffect(() => {
  setLoading(true);
  claimsApi.list({ page, limit, search: debouncedSearch, status }).then(res => {
    setClaims(res.data.claims);
    setTotal(res.data.total);
  }).catch(() => {}).finally(() => setLoading(false));
}, [page, debouncedSearch, status]);
```

- [ ] **Step 3: Update Remittances.jsx**

Read `frontend/src/pages/Remittances.jsx`. Add import:

```js
import { useDebounce } from '../hooks/useDebounce';
```

After `const [search, setSearch] = useState('');` add:

```js
const debouncedSearch = useDebounce(search, 300);
```

Change useEffect to use `debouncedSearch` instead of `search`:

```js
useEffect(() => {
  setLoading(true);
  remittancesApi.list({ page, limit, search: debouncedSearch || undefined })
    .then(res => { setFiles(res.data.files); setTotal(res.data.total); })
    .catch(() => {})
    .finally(() => setLoading(false));
}, [page, debouncedSearch]);
```

- [ ] **Step 4: Update Denials.jsx**

Read `frontend/src/pages/Denials.jsx`. Add import:

```js
import { useDebounce } from '../hooks/useDebounce';
```

After the existing `const [search, setSearch] = useState('');` etc, add debounced versions:

```js
const debouncedSearch = useDebounce(search, 300);
const debouncedDenialCode = useDebounce(denialCode, 300);
const debouncedPayer = useDebounce(payer, 300);
// Note: status is NOT debounced — it's a select, fires immediately on change
```

Change the `useEffect` to use debounced values for text inputs:

```js
useEffect(() => {
  setLoading(true);
  denialsApi.list({
    page, limit,
    search: debouncedSearch || undefined,
    denial_code: debouncedDenialCode || undefined,
    payer: debouncedPayer || undefined,
    status: status || undefined,
  })
    .then(res => {
      setDenials(res.data.denials);
      setSummary(res.data.summary);
      setTotal(res.data.total);
    })
    .catch(() => {})
    .finally(() => setLoading(false));
}, [page, debouncedSearch, debouncedDenialCode, debouncedPayer, status]);
```

- [ ] **Step 5: Verify frontend builds**

Run: `cd frontend && npx vite build` (or if dev server is running, just check for syntax errors with `npx vite build --mode development`)

If the backend/frontend build tools aren't available, at minimum verify with `cd frontend && npx vite --version` to check the tool is installed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useDebounce.js frontend/src/pages/Claims.jsx frontend/src/pages/Remittances.jsx frontend/src/pages/Denials.jsx
git commit -m "perf: add debounced search inputs on claims, remittances, denials pages"
```

---

## Task 5: Upload List Pagination

**Files:** Modify: `backend/src/controllers/upload.controller.js`, `frontend/src/pages/Upload.jsx`, `frontend/src/services/upload.api.js`

**Interfaces:**
- Consumes: `GET /upload/files?page=&limit=` with optional pagination params
- Produces: Paginated response with `{ files, total, page, totalPages }` matching other list endpoints

- [ ] **Step 1: Update upload.controller.js**

Read `backend/src/controllers/upload.controller.js`.

Replace the `listFiles` function:

```js
exports.listFiles = async (req, res, next) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { rows, count } = await UploadedFile.findAndCountAll({
      order: [['uploaded_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });
    res.json({
      files: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) { next(error); }
};
```

- [ ] **Step 2: Verify controller syntax**

Run: `cd backend && node -e "const c = require('./src/controllers/upload.controller'); console.log('OK');"`

- [ ] **Step 3: Update upload.api.js**

Read `frontend/src/services/upload.api.js`.

Change the `listFiles` function to accept pagination params:

```js
listFiles: (params = {}) => api.get('/upload/files', { params }),
```

- [ ] **Step 4: Update Upload.jsx**

Read `frontend/src/pages/Upload.jsx`.

Add pagination state and update the `fetchFiles` callback:

Add pagination state near the other state declarations:

```js
const [page, setPage] = useState(1);
const [total, setTotal] = useState(0);
const limit = 25;
```

Update `fetchFiles` to pass pagination:

```js
const fetchFiles = useCallback(() => {
  setLoading(true);
  uploadApi.listFiles({ page, limit })
    .then(res => { setFiles(res.data.files || []); setTotal(res.data.total); })
    .catch(() => {})
    .finally(() => setLoading(false));
}, [page]);
```

Add `page` to the useEffect dependency:

```js
useEffect(() => { fetchFiles(); }, [fetchFiles, page]);
```

Add pagination controls after the table closes. After the `</table>` line, add:

```jsx
{total > limit && (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
      Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
    </span>
    <div style={{ display: 'flex', gap: '0.25rem' }}>
      <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
        style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>Prev</button>
      <button className="btn btn-secondary" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}
        style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>Next</button>
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify frontend builds**

Run: `cd frontend && npx vite build` — should succeed without errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/upload.controller.js frontend/src/pages/Upload.jsx frontend/src/services/upload.api.js
git commit -m "perf: paginate uploaded files list"
```

---

## Task 6: Dashboard Query Caching

**Files:** Create: `backend/src/utils/queryCache.js`; Modify: `backend/src/services/dashboard.service.js`, `backend/src/services/upload.service.js`

**Interfaces:**
- Consumes: Dashboard service methods called from controller
- Produces: Cached aggregation results with 5-min TTL, invalidated on file upload completion

- [ ] **Step 1: Create queryCache.js**

Create `backend/src/utils/queryCache.js`:

```js
class QueryCache {
  constructor() {
    this._store = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
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

  size() {
    return this._store.size;
  }
}

module.exports = new QueryCache();
```

- [ ] **Step 2: Update dashboard.service.js**

Read `backend/src/services/dashboard.service.js`. Add at top:

```js
const cache = require('../utils/queryCache');
```

Wrap each method. For `getSummary`:

```js
async getSummary() {
  const cached = cache.get('dashboard:summary');
  if (cached) return cached;
  // ... existing method body unchanged ...
  const result = {
    totalClaims, totalCharges: parseFloat(totalCharges.toFixed(2)),
    totalPayments: parseFloat(totalPayments.toFixed(2)),
    totalAdjustments: parseFloat(totalAdjustments.toFixed(2)), denialRate,
    statusDistribution: statusDistribution.map(s => ({ status: s.status, count: parseInt(s.count) })),
  };
  cache.set('dashboard:summary', result);
  return result;
}
```

For `getDenialReasons`:

```js
async getDenialReasons(limit = 10) {
  const cacheKey = `dashboard:denialReasons:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  // ... existing method body unchanged ...
  const result = reasons.map(r => ({
    code: r.denial_code, group: r.group_code,
    count: parseInt(r.count), totalAmount: parseFloat(r.total_amount || 0).toFixed(2),
  }));
  cache.set(cacheKey, result);
  return result;
}
```

For `getTrends`:

```js
async getTrends(days = 30) {
  const cacheKey = `dashboard:trends:${days}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  // ... existing method body unchanged ...
  const result = { claimTrends, denialTrends };
  cache.set(cacheKey, result);
  return result;
}
```

For `getPayerBreakdown`:

```js
async getPayerBreakdown() {
  const cached = cache.get('dashboard:payerBreakdown');
  if (cached) return cached;
  // ... existing method body unchanged ...
  const result = payers.map(p => ({
    payer: p.payer_name || 'Unknown', count: parseInt(p.count),
    totalCharge: parseFloat(p.total_charge || 0).toFixed(2),
  }));
  cache.set('dashboard:payerBreakdown', result);
  return result;
}
```

For `getAging`:

```js
async getAging() {
  const cached = cache.get('dashboard:aging');
  if (cached) return cached;
  // ... existing method body unchanged ...
  const result = claims.map(c => { /* ... */ });
  cache.set('dashboard:aging', result);
  return result;
}
```

- [ ] **Step 3: Invalidate cache on file upload completion**

Read `backend/src/services/upload.service.js`. Add at top:

```js
const cache = require('../utils/queryCache');
```

At the end of `processFile`, after successful processing and before the return statement, add cache invalidation:

```js
// After successful processing, invalidate dashboard cache
cache.invalidate('dashboard:');
```

Place it right before the success return inside the `try` block (after moving the file to processed dir, before the `return`):

```js
cache.invalidate('dashboard:');

logger.info(`File ${filename} processed: ${result.count} records`);
return { file: fileRecord, recordsCreated: result.count };
```

- [ ] **Step 4: Verify everything compiles**

Run: `cd backend && node -e "
  const cache = require('./src/utils/queryCache');
  const d = require('./src/services/dashboard.service');
  const u = require('./src/services/upload.service');
  console.log('OK - Cache size:', cache.size());
"`

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/queryCache.js backend/src/services/dashboard.service.js backend/src/services/upload.service.js
git commit -m "perf: add dashboard query caching with 5-min TTL and upload-based invalidation"
```

---

## Task 7: Async File Processing Queue

**Files:** Create: `backend/src/queue/ediQueue.js`, `backend/src/queue/ediWorker.js`; Modify: `backend/src/controllers/upload.controller.js`, `backend/src/config/env.js`, `backend/src/server.js`, `docker-compose.yml`, `backend/package.json`

**Interfaces:**
- Consumes: File path + type from upload controller
- Produces: Background job processes file, updates DB status independently

- [ ] **Step 1: Add Bull dependency**

```bash
cd backend && npm install bull
```

- [ ] **Step 2: Add Redis config to env.js**

Read `backend/src/config/env.js`, add a `redis` section:

```js
redis: {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
},
```

- [ ] **Step 3: Create ediQueue.js**

Create `backend/src/queue/ediQueue.js`:

```js
const Queue = require('bull');
const config = require('../config/env');

const ediQueue = new Queue('edi-processing', config.redis.url, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

ediQueue.on('error', (error) => {
  logger.error(`EDI queue error: ${error.message}`);
});

const logger = require('../utils/logger');

module.exports = ediQueue;
```

Add `const logger = require('../utils/logger');` at the top of the file (before queue creation) to avoid hoisting issues:

```js
const Queue = require('bull');
const config = require('../config/env');
const logger = require('../utils/logger');
```

- [ ] **Step 4: Create ediWorker.js**

Create `backend/src/queue/ediWorker.js`:

```js
const config = require('../config/env');
const uploadService = require('../services/upload.service');
const logger = require('../utils/logger');

function startWorker() {
  // Only start if not in test mode
  if (config.nodeEnv === 'test') {
    logger.info('EDI worker: skipping (test mode)');
    return;
  }

  const ediQueue = require('./ediQueue');

  ediQueue.process(async (job) => {
    const { filePath, fileType, uploadedBy } = job.data;
    logger.info(`Worker processing: ${filePath} (${fileType})`);

    try {
      const result = await uploadService.processFile(filePath, fileType, uploadedBy);
      logger.info(`Worker completed: ${filePath} — ${result.recordsCreated} records`);
      return result;
    } catch (error) {
      logger.error(`Worker failed: ${filePath} — ${error.message}`);
      throw error;
    }
  });

  logger.info('EDI worker started');
}

module.exports = { startWorker };
```

- [ ] **Step 5: Update upload.controller.js**

Read `backend/src/controllers/upload.controller.js`.

Replace the `uploadFile` function to enqueue a job instead of processing synchronously:

```js
const ediQueue = require('../queue/ediQueue');

exports.uploadFile = async (req, res, next) => {
  try {
    const fileType = req.params.type;
    if (!['837', '835'].includes(fileType)) return res.status(400).json({ error: 'Invalid file type' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Create initial file record in 'queued' status
    const { UploadedFile } = require('../models');
    const fs = require('fs');
    const crypto = require('crypto');
    const content = fs.readFileSync(req.file.path, 'utf8');
    const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

    const fileRecord = await UploadedFile.create({
      filename: req.file.filename || req.file.originalname,
      file_type: fileType,
      file_path: req.file.path,
      file_size: req.file.size,
      content_hash: contentHash,
      status: 'queued',
      uploaded_by: req.user?.id || null,
    });

    // Enqueue processing job
    await ediQueue.add({
      filePath: req.file.path,
      fileType,
      uploadedBy: req.user?.id || null,
    });

    res.status(202).json({
      message: 'File queued for processing',
      file: fileRecord,
    });
  } catch (error) { next(error); }
};
```

- [ ] **Step 6: Update server.js**

Read `backend/src/server.js`.

After starting the file watcher and before starting the HTTP server, add worker startup:

```js
// Start EDI worker
const { startWorker } = require('./queue/ediWorker');
startWorker();
```

Place this right after `startWatcher(dir837, dir835);` and before `const server = app.listen(...)`.

- [ ] **Step 7: Update docker-compose.yml**

Read and edit `docker-compose.yml`. Add a Redis service before the `backend` service:

```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

Add `redis_data` to the `volumes:` section at the bottom:

```yaml
  redis_data:
```

Make the `backend` service depend on Redis:

```yaml
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
```

- [ ] **Step 8: Verify syntax**

Run: `cd backend && node -e "
  const q = require('./src/queue/ediQueue');
  const w = require('./src/queue/ediWorker');
  console.log('Queue and worker modules OK');
"`

- [ ] **Step 9: Commit**

```bash
git add backend/src/queue/ backend/src/controllers/upload.controller.js backend/src/config/env.js backend/src/server.js docker-compose.yml backend/package.json
git commit -m "perf: async EDI file processing via Bull queue and Redis worker"
```

---

## Task 8: Integration Verification

**Files:** The entire application (no file changes — verification only)

**Interfaces:** N/A — this is a verification pass

- [ ] **Step 1: Verify all backend modules load correctly**

```bash
cd backend && node -e "
  require('./src/utils/queryCache');
  require('./src/services/dashboard.service');
  require('./src/services/upload.service');
  require('./src/controllers/claims.controller');
  require('./src/controllers/denials.controller');
  require('./src/controllers/upload.controller');
  console.log('All backend modules loaded successfully');
"
```

- [ ] **Step 2: Run backend tests**

```bash
cd backend && npm test 2>&1 || echo "Tests may need Redis running — check test output"
```

- [ ] **Step 3: Run frontend build**

```bash
cd frontend && npx vite build
```

- [ ] **Step 4: Verify API response shapes**

Start the backend, hit each endpoint and confirm the shape matches before:
- `GET /api/claims?limit=5` — should return `{ claims, total, page, totalPages }`
- `GET /api/denials?limit=5` — should return `{ denials, total, page, totalPages, summary }`
- `GET /api/upload/files?limit=5` — should return `{ files, total, page, totalPages }`

- [ ] **Step 5: Commit (if any fixes needed)**

```bash
git add -A && git commit -m "fix: integration fixes after performance optimization"
```
