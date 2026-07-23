# Payer Breakdown Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side pagination to the Claims by Payor card so it shows 10 payers per page with Prev/Next and numbered page buttons.

**Architecture:** Backend accepts `page` and `limit` query params, returns `{ breakdown: [...], total: N }`. Frontend stores pagination state in the hook, passes it to the component, which renders page controls.

**Tech Stack:** Node.js/Express, Sequelize/Postgres, React

## Global Constraints

- Page is 1-based, default page=1, limit=10
- Backend clamps limit between 1 and 100
- Frontend pagination controls show Prev/Next + up to 5 numbered page buttons with ellipsis
- Follow existing code patterns (`.btn-secondary` for buttons, `.table` for table styles)

---

### Task 1: Backend — Add pagination to `getPayerBreakdown`

**Files:**
- Modify: `backend/src/services/dashboard.service.js:76-89`
- Modify: `backend/src/controllers/dashboard.controller.js:18-21`

**Interfaces:**
- Produces: `dashboardService.getPayerBreakdown(limit = 10, offset = 0)` returns `{ breakdown: [...], total: number }`
- Consumes: `req.query.page` and `req.query.limit` from controller

- [ ] **Step 1: Update service to accept pagination params**

Edit `backend/src/services/dashboard.service.js` — change `getPayerBreakdown()`:

```js
async getPayerBreakdown(limit = 10, offset = 0) {
  const cacheKey = `dashboard:payerBreakdown:${limit}:${offset}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;
  const payers = await Claim.findAll({
    attributes: ['payer_name', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('total_charge')), 'total_charge']],
    group: ['payer_name'], order: [[literal('"count"'), 'DESC']],
    limit, offset, raw: true,
  });
  const breakdown = payers.map(p => ({
    payer: p.payer_name || 'Unknown', count: parseInt(p.count),
    totalCharge: parseFloat(p.total_charge || 0).toFixed(2),
  }));
  // Total distinct payers for pagination
  const totalResult = await Claim.findAll({
    attributes: [[fn('COUNT', fn('DISTINCT', col('payer_name'))), 'total']],
    raw: true,
  });
  const total = parseInt(totalResult[0]?.total || 0);
  const result = { breakdown, total };
  await cache.set(cacheKey, result);
  return result;
}
```

- [ ] **Step 2: Update controller to parse page/limit params**

Edit `backend/src/controllers/dashboard.controller.js`:

```js
exports.payerBreakdown = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const result = await dashboardService.getPayerBreakdown(limit, offset);
    res.json(result);
  } catch (error) { next(error); }
};
```

The service now returns `{ breakdown: [...], total: N }` directly, so the controller just passes it through.

- [ ] **Step 3: Run existing tests to confirm no regressions**

Run: `cd backend && npx jest tests/dashboard.test.js --no-cache --forceExit`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/dashboard.service.js backend/src/controllers/dashboard.controller.js
git commit -m "feat: add server-side pagination to payer breakdown endpoint"
```

---

### Task 2: Backend — Update dashboard tests

**Files:**
- Modify: `backend/tests/dashboard.test.js`

**Interfaces:**
- Consumes: `GET /api/dashboard/payer-breakdown?page=1&limit=10` returns `{ breakdown: { breakdown: [...], total: N } }`

- [ ] **Step 1: Add test for payer breakdown pagination**

Edit `backend/tests/dashboard.test.js` — add after the existing `denial-reasons` test:

```js
it('should return paginated payer breakdown', async () => {
  const res = await request(app)
    .get('/api/dashboard/payer-breakdown?page=1&limit=10')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.breakdown).toBeDefined();
  expect(Array.isArray(res.body.breakdown)).toBe(true);
  expect(typeof res.body.total).toBe('number');
});
```

- [ ] **Step 2: Run tests**

Run: `cd backend && npx jest tests/dashboard.test.js --no-cache --forceExit`
Expected: All 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/tests/dashboard.test.js
git commit -m "test: add payer breakdown pagination test"
```

---

### Task 3: Frontend — Update API service

**Files:**
- Modify: `frontend/src/services/dashboard.api.js`

**Interfaces:**
- Produces: `dashboardApi.payerBreakdown(page = 1, limit = 10)` → `GET /dashboard/payer-breakdown?page=${page}&limit=${limit}`

- [ ] **Step 1: Add page/limit params to payerBreakdown**

Edit `frontend/src/services/dashboard.api.js`:

```js
payerBreakdown: (page = 1, limit = 10) => api.get(`/dashboard/payer-breakdown?page=${page}&limit=${limit}`),
```

- [ ] **Step 2: Verify the file builds/lints**

Run: `cd frontend && npx vite build` (or `npm run build`)
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/dashboard.api.js
git commit -m "feat: add pagination params to payerBreakdown API call"
```

---

### Task 4: Frontend — Add pagination state to hook

**Files:**
- Modify: `frontend/src/hooks/useDashboard.js`

**Interfaces:**
- Produces: `{ ..., payerBreakdown, payerPage, payerTotalPages, payerTotal, setPayerPage }`
- Consumes: `dashboardApi.payerBreakdown(page, limit)`

- [ ] **Step 1: Add pagination state and setPayerPage**

Edit `frontend/src/hooks/useDashboard.js`:

```js
import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../services/dashboard.api';

export function useDashboard() {
  const [summary, setSummary] = useState(null);
  const [denialReasons, setDenialReasons] = useState([]);
  const [trends, setTrends] = useState(null);
  const [payerBreakdown, setPayerBreakdown] = useState([]);
  const [payerPage, setPayerPage] = useState(1);
  const [payerTotalPages, setPayerTotalPages] = useState(1);
  const [payerTotal, setPayerTotal] = useState(0);
  const [aging, setAging] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, dr, t, pb, a] = await Promise.all([
        dashboardApi.summary(), dashboardApi.denialReasons(10),
        dashboardApi.trends(30), dashboardApi.payerBreakdown(1, 10), dashboardApi.aging(),
      ]);
      setSummary(s.data); setDenialReasons(dr.data.reasons);
      setTrends(t.data);
      setPayerBreakdown(pb.data.breakdown);
      setPayerTotalPages(Math.ceil(pb.data.total / 10) || 1);
      setPayerTotal(pb.data.total);
      setAging(a.data.aging);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);  // no page dependency — initial load always page 1

  const fetchPayerBreakdown = useCallback(async (page) => {
    try {
      const pb = await dashboardApi.payerBreakdown(page, 10);
      setPayerBreakdown(pb.data.breakdown);
      setPayerTotalPages(Math.ceil(pb.data.total / 10) || 1);
      setPayerTotal(pb.data.total);
      setPayerPage(page);
    } catch (err) { /* ignore — dashboard still shows */ }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  return {
    summary, denialReasons, trends,
    payerBreakdown, payerPage, payerTotalPages, payerTotal,
    setPayerPage: fetchPayerBreakdown,
    aging, loading, error, refetch: fetchAll,
  };
}
```

- [ ] **Step 2: Verify the file builds**

Run: `cd frontend && npx vite build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useDashboard.js
git commit -m "feat: add payer pagination state to dashboard hook"
```

---

### Task 5: Frontend — Add pagination UI to PayerBreakdown component

**Files:**
- Modify: `frontend/src/components/Charts/PayerBreakdown.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`

**Interfaces:**
- PayerBreakdown props: `{ breakdown, page, totalPages, onPageChange }`
- Dashboard.jsx passes new props from `useDashboard()`

- [ ] **Step 1: Rewrite PayerBreakdown component with pagination**

Edit `frontend/src/components/Charts/PayerBreakdown.jsx`:

```jsx
import React from 'react';

const fmt = (v) => v?.toLocaleString() ?? '—';
const currency = (v) => v != null ? `$${parseFloat(v).toLocaleString()}` : '—';

export default function PayerBreakdown({ breakdown, page, totalPages, onPageChange }) {
  if (!breakdown?.length) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No payer data yet</div>;

  const total = breakdown.reduce((s, p) => s + p.count, 0);

  // Build page number array with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, page - 1);
      let end = Math.min(totalPages - 1, page + 1);
      if (page <= 3) { start = 2; end = Math.min(maxVisible, totalPages - 1); }
      if (page >= totalPages - 2) { start = Math.max(2, totalPages - maxVisible + 1); end = totalPages - 1; }
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="card">
      <div className="card-header">Claims by Payer</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Payer</th>
              <th style={{ textAlign: 'right' }}>Claims</th>
              <th style={{ textAlign: 'right' }}>% of Total</th>
              <th style={{ textAlign: 'right' }}>Total Charges</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((p, i) => (
              <tr key={i}>
                <td>{p.payer}</td>
                <td style={{ textAlign: 'right' }}>{fmt(p.count)}</td>
                <td style={{ textAlign: 'right' }}>{total > 0 ? `${(p.count / total * 100).toFixed(1)}%` : '—'}</td>
                <td style={{ textAlign: 'right' }}>{currency(p.totalCharge)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
        <button
          className="btn btn-secondary"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          « Prev
        </button>
        {getPageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} style={{ padding: '0 0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>…</span>
          ) : (
            <button
              key={p}
              className="btn"
              style={{
                padding: '0.25rem 0.5rem', fontSize: '0.75rem', minWidth: '28px',
                background: p === page ? 'var(--color-primary)' : 'var(--bg-card)',
                color: p === page ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                ...(p === page ? { borderColor: 'var(--color-primary)' } : {}),
              }}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          className="btn btn-secondary"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next »
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update Dashboard.jsx to pass new props**

Edit `frontend/src/pages/Dashboard.jsx` — change the `PayerBreakdown` usage:

```jsx
<PayerBreakdown
  breakdown={payerBreakdown}
  page={payerPage}
  totalPages={payerTotalPages}
  onPageChange={setPayerPage}
/>
```

Also destructure the new props at the top:

```js
const { summary, denialReasons, trends, payerBreakdown, payerPage, payerTotalPages, setPayerPage, aging, loading, error } = useDashboard();
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npx vite build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Charts/PayerBreakdown.jsx frontend/src/pages/Dashboard.jsx
git commit -m "feat: add pagination controls to Claims by Payor card"
```
