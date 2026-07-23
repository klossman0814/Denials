# Task 2: Backend — Update dashboard tests

**Files:**
- Modify: `backend/tests/dashboard.test.js`

**Interfaces:**
- Consumes: `GET /api/dashboard/payer-breakdown?page=1&limit=10` returns `{ breakdown: [...], total: N }`

## Steps

### Step 1: Add test for payer breakdown pagination

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

### Step 2: Run tests

Run: `cd backend && npx jest tests/dashboard.test.js --no-cache --forceExit`
Expected: All 3 tests pass

### Step 3: Commit

```bash
git add backend/tests/dashboard.test.js
git commit -m "test: add payer breakdown pagination test"
```
