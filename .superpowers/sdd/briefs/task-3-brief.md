# Task 3: Frontend — Update API service

**Files:**
- Modify: `frontend/src/services/dashboard.api.js`

**Interfaces:**
- Produces: `dashboardApi.payerBreakdown(page = 1, limit = 10)` → `GET /dashboard/payer-breakdown?page=${page}&limit=${limit}`

## Steps

### Step 1: Add page/limit params to payerBreakdown

Edit `frontend/src/services/dashboard.api.js`:

```js
payerBreakdown: (page = 1, limit = 10) => api.get(`/dashboard/payer-breakdown?page=${page}&limit=${limit}`),
```

### Step 2: Verify the file builds/lints

Run: `cd frontend && npx vite build` (or `npm run build`)
Expected: No errors

### Step 3: Commit

```bash
git add frontend/src/services/dashboard.api.js
git commit -m "feat: add pagination params to payerBreakdown API call"
```
