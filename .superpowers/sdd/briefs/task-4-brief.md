# Task 4: Frontend — Add pagination state to hook

**Files:**
- Modify: `frontend/src/hooks/useDashboard.js`

**Interfaces:**
- Produces: `{ ..., payerBreakdown, payerPage, payerTotalPages, payerTotal, setPayerPage }`
- Consumes: `dashboardApi.payerBreakdown(page, limit)`

## Steps

### Step 1: Add pagination state and setPayerPage

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

### Step 2: Verify the file builds

Run: `cd frontend && npx vite build`
Expected: No errors

### Step 3: Commit

```bash
git add frontend/src/hooks/useDashboard.js
git commit -m "feat: add payer pagination state to dashboard hook"
```
