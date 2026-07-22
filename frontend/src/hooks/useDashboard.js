import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../services/dashboard.api';

export function useDashboard() {
  const [summary, setSummary] = useState(null);
  const [denialReasons, setDenialReasons] = useState([]);
  const [trends, setTrends] = useState(null);
  const [payerBreakdown, setPayerBreakdown] = useState([]);
  const [aging, setAging] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, dr, t, pb, a] = await Promise.all([
        dashboardApi.summary(), dashboardApi.denialReasons(10),
        dashboardApi.trends(30), dashboardApi.payerBreakdown(), dashboardApi.aging(),
      ]);
      setSummary(s.data); setDenialReasons(dr.data.reasons);
      setTrends(t.data); setPayerBreakdown(pb.data.breakdown); setAging(a.data.aging);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  return { summary, denialReasons, trends, payerBreakdown, aging, loading, error, refetch: fetchAll };
}
