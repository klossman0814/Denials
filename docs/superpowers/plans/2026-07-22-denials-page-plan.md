# Standalone Denials Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Denials page that lists all denial reasons across all claims with filtering, summary stats, and click-to-claim navigation.

**Architecture:** New backend API endpoint at `/api/denials` with a controller that queries DenialReason with JOINs to Claim, ClaimLine, and Remittance. New React page component that renders a filterable table with summary stat cards. New nav item between Claims and Upload.

**Tech Stack:** Express.js + Sequelize (backend), React 18 + Recharts (frontend)

**Global Constraints**
- Follow existing patterns in `backend/src/controllers/` and `backend/src/routes/`
- Follow existing page patterns in `frontend/src/pages/` (Claims.jsx style)
- Use same StatusBadge, currency formatting, and layout classes as existing pages
- No database migrations — query existing models only
- All API routes require `authenticate` middleware
- Frontend builds without errors via `npx vite build`

---

### Task 1: Backend — Denials API Controller + Routes

**Files:**
- Create: `backend/src/controllers/denials.controller.js`
- Create: `backend/src/routes/denials.routes.js`
- Modify: `backend/src/app.js` (lines 27-37 — add require and mount)

**Interfaces:**
- Consumes: `GET /api/denials?page=1&limit=25&search=&denial_code=&payer=&status=`
- Produces: `{ denials: [...], total, page, totalPages, summary }` — consumed by `frontend/src/services/denials.api.js`

- [ ] **Step 1: Create `backend/src/controllers/denials.controller.js`**

```javascript
const { Op, fn, col, literal } = require('sequelize');
const { DenialReason, Claim, ClaimLine, Remittance } = require('../models');

exports.listDenials = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, search, denial_code, payer, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause
    const where = {};
    if (denial_code) where.denial_code = denial_code;
    if (search) {
      where[Op.or] = [
        { denial_code: { [Op.iLike]: `%${search}%` } },
        { reason_description: { [Op.iLike]: `%${search}%` } },
        { '$Claim.claim_id$': { [Op.iLike]: `%${search}%` } },
        { '$Claim.patient_first_name$': { [Op.iLike]: `%${search}%` } },
        { '$Claim.patient_last_name$': { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Build include for Claim with optional filters
    const claimWhere = {};
    if (payer) claimWhere.payer_name = { [Op.iLike]: `%${payer}%` };
    if (status) claimWhere.status = status;

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
        {
          model: ClaimLine,
          attributes: ['procedure_code', 'line_number'],
          required: false,
        },
        {
          model: Remittance,
          attributes: ['remittance_date'],
          required: false,
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      subQuery: false, // needed for proper count with joins
    });

    // Compute summary stats
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

    // Get top denial code
    const topCode = await DenialReason.findAll({
      attributes: ['denial_code', [fn('COUNT', col('id')), 'count']],
      where,
      group: ['denial_code'],
      order: [[literal('"count"'), 'DESC']],
      limit: 1,
      raw: true,
    });

    // Map rows to clean response format
    const denials = rows.map(d => {
      const json = d.toJSON();
      const claim = json.Claim || {};
      const claimLine = json.ClaimLine || {};
      const remittance = json.Remittance || {};
      return {
        id: json.id,
        denialCode: json.denial_code,
        groupCode: json.group_code,
        amount: parseFloat(json.amount || 0),
        reasonDescription: json.reason_description,
        createdAt: json.created_at,
        claimId: claim.id,
        claimNumber: claim.claim_id,
        patientName: `${claim.patient_first_name || ''} ${claim.patient_last_name || ''}`.trim() || null,
        patientDOB: claim.patient_dob,
        subscriberId: claim.subscriber_id,
        payerName: claim.payer_name,
        providerName: claim.provider_name,
        providerNPI: claim.provider_npi,
        serviceDateStart: claim.service_date_start,
        serviceDateEnd: claim.service_date_end,
        claimStatus: claim.status,
        procedureCode: claimLine.procedure_code || null,
        remittanceDate: remittance.remittance_date || null,
      };
    });

    const summary = {
      totalDenials: parseInt(summaryQuery[0]?.totalDenials || 0),
      totalDeniedAmount: parseFloat(summaryQuery[0]?.totalDeniedAmount || 0),
      uniqueCodes: parseInt(summaryQuery[0]?.uniqueCodes || 0),
      payersAffected: parseInt(summaryQuery[0]?.payersAffected || 0),
      topCode: topCode.length ? { code: topCode[0].denial_code, count: parseInt(topCode[0].count) } : null,
    };

    res.json({
      denials,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
      summary,
    });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 2: Create `backend/src/routes/denials.routes.js`**

```javascript
const { Router } = require('express');
const controller = require('../controllers/denials.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();
router.get('/', authenticate, controller.listDenials);

module.exports = router;
```

- [ ] **Step 3: Modify `backend/src/app.js`**

Add the require after line 31:
```javascript
const denialsRoutes = require('./routes/denials.routes');
```

Add the mount after line 37 (`app.use('/api/admin', adminRoutes);`):
```javascript
app.use('/api/denials', denialsRoutes);
```

- [ ] **Step 4: Verify the API starts without errors**

Run: `cd backend && node -e "require('./src/app.js'); console.log('app loaded ok')"`
Expected: `app loaded ok` (no crash from bad requires)

---

### Task 2: Frontend — Denials API Service + Denials Page

**Files:**
- Create: `frontend/src/services/denials.api.js`
- Create: `frontend/src/pages/Denials.jsx`

**Interfaces:**
- Consumes: `GET /api/denials` response format from Task 1
- Produces: Navigable page at `/denials` route — consumed by Task 3

- [ ] **Step 1: Create `frontend/src/services/denials.api.js`**

```javascript
import api from './api';

export const denialsApi = {
  list: (params) => api.get('/denials', { params }),
};
```

- [ ] **Step 2: Create `frontend/src/pages/Denials.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { denialsApi } from '../services/denials.api';
import StatusBadge from '../components/StatusBadge';

const currency = (v) => v != null ? `$${Number(v).toLocaleString()}` : '—';

function SummaryCard({ label, value, sub }) {
  return (
    <div className="card stat-card" style={{ cursor: 'default' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );
}

export default function Denials() {
  const navigate = useNavigate();
  const [denials, setDenials] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [denialCode, setDenialCode] = useState('');
  const [payer, setPayer] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    setLoading(true);
    denialsApi.list({ page, limit, search: search || undefined, denial_code: denialCode || undefined, payer: payer || undefined, status: status || undefined })
      .then(res => {
        setDenials(res.data.denials);
        setSummary(res.data.summary);
        setTotal(res.data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, denialCode, payer, status]);

  const handleRowClick = (claimId) => {
    if (claimId) navigate(`/claims/${claimId}`);
  };

  return (
    <div className="page">
      <h2 className="page-title">Denials</h2>

      {/* Summary Stats */}
      {summary && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: '1rem' }}>
          <SummaryCard label="Total Denials" value={summary.totalDenials?.toLocaleString()} sub={`${total} shown`} />
          <SummaryCard label="Total Denied $" value={currency(summary.totalDeniedAmount)} />
          <SummaryCard label="Unique Codes" value={summary.uniqueCodes} />
          <SummaryCard label="Payers Affected" value={summary.payersAffected} />
          <SummaryCard label={`Top Code: ${summary.topCode?.code || '—'}`} value={summary.topCode?.count?.toLocaleString() || '—'} sub={summary.topCode ? 'occurrences' : ''} />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search code, reason, patient, claim..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: '200px' }} />
        <input className="form-input" placeholder="Denial Code"
          value={denialCode} onChange={(e) => { setDenialCode(e.target.value); setPage(1); }}
          style={{ width: '140px' }} />
        <input className="form-input" placeholder="Payer"
          value={payer} onChange={(e) => { setPayer(e.target.value); setPage(1); }}
          style={{ width: '160px' }} />
        <select className="form-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          style={{ width: '140px' }}>
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="paid">Paid</option>
          <option value="denied">Denied</option>
          <option value="partial">Partial</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : denials.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          No denials found. Upload EDI 835 files to see denial data.
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th><th>Reason</th><th>Amount</th><th>Patient</th>
                  <th>Payer</th><th>Claim ID</th><th>Status</th>
                  <th>Service Date</th><th>Procedure</th><th>Group</th>
                </tr>
              </thead>
              <tbody>
                {denials.map((d) => (
                  <tr key={d.id}
                    onClick={() => handleRowClick(d.claimId)}
                    style={{ cursor: 'pointer' }}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{d.denialCode}</td>
                    <td title={d.reasonDescription || ''} style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.reasonDescription || '—'}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{currency(d.amount)}</td>
                    <td>{d.patientName || '—'}</td>
                    <td>{d.payerName || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{d.claimNumber || '—'}</td>
                    <td><StatusBadge status={d.claimStatus} /></td>
                    <td>{d.serviceDateStart ? new Date(d.serviceDateStart).toLocaleDateString() : '—'}</td>
                    <td style={{ fontFamily: 'monospace' }}>{d.procedureCode || '—'}</td>
                    <td>{d.groupCode ? <span className="badge badge-pending">{d.groupCode}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the page builds**

Run: `cd frontend && npx vite build 2>&1 | tail -20`
Expected: Build completes with no errors, output includes `dist/index.html`

---

### Task 3: Frontend — Wire Up Routing + Navigation

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Layout/Sidebar.jsx`

**Interfaces:**
- Consumes: Denials page component from Task 2
- Produces: Navigable `/denials` route and sidebar entry

- [ ] **Step 1: Modify `frontend/src/App.jsx`**

Add import after line 9 (`import Admin from './pages/Admin'`):
```javascript
import Denials from './pages/Denials';
```

Add route after the Claims detail route (after line 42):
```jsx
<Route path="/denials" element={<Denials />} />
```

So the protected routes section becomes:
```jsx
<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/claims" element={<Claims />} />
  <Route path="/claims/:id" element={<ClaimDetail />} />
  <Route path="/denials" element={<Denials />} />
  <Route path="/upload" element={<Upload />} />
  <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
</Route>
```

- [ ] **Step 2: Modify `frontend/src/components/Layout/Sidebar.jsx`**

Add the Denials nav item between Claims and Upload in the `navItems` array:

```javascript
const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/claims', label: 'Claims', icon: '📋' },
  { path: '/denials', label: 'Denials', icon: '🚫' },
  { path: '/upload', label: 'Upload Files', icon: '📤' },
  { path: '/admin', label: 'Admin', icon: '⚙️', adminOnly: true },
];
```

- [ ] **Step 3: Verify the frontend builds with the new route**

Run: `cd frontend && npx vite build 2>&1 | tail -10`
Expected: Build completes with no errors.

---

## Verification

After all tasks complete, run these checks:

1. **Backend load check:** `node -e "require('./src/app.js'); console.log('OK')"` from `backend/`
2. **Frontend build:** `npx vite build` from `frontend/` — no errors
3. **LSP diagnostics:** Run lsp_diagnostics on all modified/created files
