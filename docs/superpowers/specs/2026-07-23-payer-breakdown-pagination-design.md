# Server-Side Pagination for Claims by Payor Card

Date: 2026-07-23

## Problem

The "Claims by Payor" card on the dashboard renders every distinct payer in the database
in a single unsorted table. For installations with dozens or hundreds of payers, this
makes the card extremely tall and hard to scan.

## Design

Add server-side pagination so the card shows 10 payers at a time with page controls.

### Backend: `dashboard.service.js`

Change `getPayerBreakdown()` signature to accept pagination params:

```js
getPayerBreakdown(limit = 10, offset = 0)
```

- Apply `limit` and `offset` to the existing `Claim.findAll` query (already ordered by count DESC)
- Add a second query: `SELECT COUNT(DISTINCT payer_name) FROM claims` to get the total distinct payer count
- Return `{ breakdown: [...], total: <number> }`

### Backend: `dashboard.controller.js`

Parse query params:

| Param  | Default | Description            |
|--------|---------|------------------------|
| page   | 1       | Current page (1-based) |
| limit  | 10      | Rows per page          |

- Compute `offset = (page - 1) * limit`
- Clamp `page >= 1`, `limit` between 1 and 100
- Pass to service

### Backend: `dashboard.routes.js`

No changes needed — existing route handles the new query params naturally.

### Frontend: `dashboard.api.js`

```js
payerBreakdown(page = 1, limit = 10) =>
  api.get(`/dashboard/payer-breakdown?page=${page}&limit=${limit}`)
```

### Frontend: `useDashboard.js`

Add pagination state:
- `payerPage` (starts at 1)
- `payerTotalPages` (derived from total in response)
- `payerTotal` (raw total from response)

Add `setPayerPage(n)` that refetches only the payer breakdown (keeps the rest of the
dashboard cached). On initial load, fetch page 1 as part of `Promise.all`.

Return new state so `Dashboard.jsx` can pass it down.

### Frontend: `PayerBreakdown.jsx`

Accept new props: `page`, `totalPages`, `onPageChange`.

Render the existing table for the current page's payers.

Add a pagination footer below the table with:

- **« Prev** button, disabled on page 1
- **Numbered page buttons** — show a window of up to 5 pages around the current page,
  with ellipsis for large gaps (e.g. `1 … 3 4 5 … 12`)
- **Next »** button, disabled on last page

Pagination controls use existing `.btn` / `.btn-secondary` styles. Compact layout —
aligned right, small gap between buttons.

### Frontend: `Dashboard.jsx`

Pass the new payer pagination props to `<PayerBreakdown>`:

```jsx
<PayerBreakdown
  breakdown={payerBreakdown}
  page={payerPage}
  totalPages={payerTotalPages}
  onPageChange={setPayerPage}
/>
```

## Files Changed

| File | Change |
|------|--------|
| `backend/src/services/dashboard.service.js` | Add limit/offset + total count query |
| `backend/src/controllers/dashboard.controller.js` | Parse page/limit params |
| `backend/tests/dashboard.test.js` | Update tests for new response shape |
| `frontend/src/services/dashboard.api.js` | Add page/limit params to payerBreakdown |
| `frontend/src/hooks/useDashboard.js` | Add payer pagination state + setPayerPage |
| `frontend/src/components/Charts/PayerBreakdown.jsx` | Add paginated table + page controls |
| `frontend/src/pages/Dashboard.jsx` | Pass pagination props to PayerBreakdown |

## Future Considerations

- If payer count grows past ~500, consider server-side search/filter too
- The total count query (`COUNT(DISTINCT payer_name)`) is fast even at scale because
  Postgres maintains stats on distinct values
