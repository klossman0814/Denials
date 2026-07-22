# Standalone Denials Page — Design Spec

## Overview

Add a dedicated "Denials" page to the Insurance Denials Management System that provides a bird's-eye view of every denial across all claims. Users can see all pertinent denial information in one place, filter/search through denials, and click through to the full claim detail.

## 1. Backend: New Denials API

### Route

```
GET /api/denials
```

### Authentication

All requests require JWT authentication via `authenticate` middleware.

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 25 | Results per page |
| `search` | string | — | Search across denial code, reason, patient name, claim ID |
| `denial_code` | string | — | Filter by specific denial code |
| `payer` | string | — | Filter by payer name (partial match) |
| `status` | string | — | Filter by parent claim status |

### Response Shape

```json
{
  "denials": [
    {
      "id": "uuid",
      "denialCode": "CO-16",
      "groupCode": "CO",
      "amount": 250.00,
      "reasonDescription": "Missing/incomplete/invalid information",
      "createdAt": "2026-07-22T...",

      "claimId": "claim-uuid",
      "claimNumber": "CLM-001",
      "patientName": "John Doe",
      "patientDOB": "1985-03-15",
      "subscriberId": "MEM-12345",
      "payerName": "Blue Cross Blue Shield",
      "providerName": "Smith Medical Group",
      "providerNPI": "1234567890",
      "serviceDateStart": "2026-06-01",
      "serviceDateEnd": "2026-06-01",
      "claimStatus": "denied",

      "procedureCode": "99213",
      "remittanceDate": "2026-07-15"
    }
  ],
  "total": 1247,
  "page": 1,
  "totalPages": 50,
  "summary": {
    "totalDenials": 1247,
    "totalDeniedAmount": 892000.00,
    "uniqueCodes": 45,
    "payersAffected": 38,
    "topCode": { "code": "CO-16", "count": 413 }
  }
}
```

### New Files

- `backend/src/controllers/denials.controller.js`
- `backend/src/routes/denials.routes.js`

### Modified Files

- `backend/src/app.js` — mount `denialsRoutes` at `/api/denials`

## 2. Frontend: New Denials Page

### Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Denials                                      [Search...]   │
│                                                             │
│  [Summary Stats Bar — 5 KPI cards]                          │
│                                                             │
│  Filters:  [Denial Code ▼] [Payer ▼] [Status ▼]           │
│                                                             │
│  Table (10 columns):                                        │
│  Code | Reason | $Amount | Patient | Payer | Claim | Status│
│  Svc Date | Procedure | Group Code                          │
│                                                             │
│  Row click → navigate(/claims/:claimId)                     │
│                                         Prev  Next          │
└─────────────────────────────────────────────────────────────┘
```

### Columns (in order)

| Column | Data | Formatting |
|--------|------|------------|
| Denial Code | `denialCode` | Monospace, bold |
| Reason | `reasonDescription` | Truncate 60 chars, title tooltip |
| Amount | `amount` | Currency `$250.00` |
| Patient | `patientName` | — |
| Payer | `payerName` | — |
| Claim ID | `claimNumber` | Monospace |
| Claim Status | `claimStatus` | StatusBadge component |
| Service Date | `serviceDateStart` | `toLocaleDateString()` |
| Procedure Code | `procedureCode` | Monospace, or `—` |
| Group Code | `groupCode` | Pill/badge style |

### KPI Summary Cards

| Metric | Source |
|--------|--------|
| Total Denials | `summary.totalDenials` |
| Total Denied $ | `summary.totalDeniedAmount` |
| Unique Codes | `summary.uniqueCodes` |
| Payers Hit | `summary.payersAffected` |
| Top Code | `summary.topCode.code` + count |

### Filter Behavior

- **Search input** — debounced 300ms, resets to page 1
- **Denial Code** dropdown — populated from unique codes in data
- **Payer** dropdown — populated from unique payers
- **Status** dropdown — submitted/paid/denied/partial/all
- All filters reset to page 1 on change

### Click Behavior

- Clicking any row navigates to `/claims/:claimId` (existing ClaimDetail page)
- Entire row is clickable with cursor:pointer

### Empty State

"No denials found. Upload EDI 835 files to see denial data."

### Loading State

Spinner centered in page content area.

### New Files

- `frontend/src/pages/Denials.jsx`
- `frontend/src/services/denials.api.js`

### Modified Files

- `frontend/src/App.jsx` — import Denials, add `<Route path="/denials">`
- `frontend/src/components/Layout/Sidebar.jsx` — add "Denials" nav item

## 3. Navigation Changes

### Sidebar Update

Add between "Claims" and "Upload Files":

```js
{ path: '/denials', label: 'Denials', icon: '🚫' },
```

### Route Update

Inside the protected `<AppLayout>` route group:

```jsx
<Route path="/denials" element={<Denials />} />
```

## 4. Files Summary

### Create (4 files)

| # | File | Purpose |
|---|------|---------|
| 1 | `backend/src/controllers/denials.controller.js` | API endpoint logic |
| 2 | `backend/src/routes/denials.routes.js` | Route definition |
| 3 | `frontend/src/pages/Denials.jsx` | Denials page component |
| 4 | `frontend/src/services/denials.api.js` | API client |

### Modify (3 files)

| # | File | Change |
|---|------|--------|
| 1 | `backend/src/app.js` | Mount denials routes |
| 2 | `frontend/src/App.jsx` | Add `/denials` route |
| 3 | `frontend/src/components/Layout/Sidebar.jsx` | Add nav item |

## 5. What This Does NOT Change

- The existing Claims list page
- The Claim Detail page (denial reasons table stays)
- The Dashboard (denial KPIs stay)
- Any existing API contracts
- Database schema (no migrations needed)
