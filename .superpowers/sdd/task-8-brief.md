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
