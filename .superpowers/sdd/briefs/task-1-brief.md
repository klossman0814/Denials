# Task 1: Backend — Add pagination to `getPayerBreakdown`

**Files:**
- Modify: `backend/src/services/dashboard.service.js:76-89`
- Modify: `backend/src/controllers/dashboard.controller.js:18-21`

**Interfaces:**
- Produces: `dashboardService.getPayerBreakdown(limit = 10, offset = 0)` returns `{ breakdown: [...], total: number }`
- Consumes: `req.query.page` and `req.query.limit` from controller

## Steps

### Step 1: Update service to accept pagination params

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

### Step 2: Update controller to parse page/limit params

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

### Step 3: Run existing tests to confirm no regressions

Run: `cd backend && npx jest tests/dashboard.test.js --no-cache --forceExit`
Expected: All tests pass

### Step 4: Commit

```bash
git add backend/src/services/dashboard.service.js backend/src/controllers/dashboard.controller.js
git commit -m "feat: add server-side pagination to payer breakdown endpoint"
```
