import React from 'react';
import { useDashboard } from '../hooks/useDashboard';
import StatusBadge from '../components/StatusBadge';
import ClaimVolumeChart from '../components/Charts/ClaimVolumeChart';
import DenialRateChart from '../components/Charts/DenialRateChart';
import TopDenialReasons from '../components/Charts/TopDenialReasons';
import FinancialImpact from '../components/Charts/FinancialImpact';
import PayerBreakdown from '../components/Charts/PayerBreakdown';

const fmt = (v) => v?.toLocaleString() ?? '—';
const currency = (v) => v != null ? `$${v.toLocaleString()}` : '—';
const pct = (v) => v != null ? `${v.toFixed(1)}%` : '—';

export default function Dashboard() {
  const { summary, denialReasons, trends, payerBreakdown, aging, loading, error } = useDashboard();

  if (loading) return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
      <div className="spinner" />
    </div>
  );
  if (error) return (
    <div className="card" style={{ color: 'var(--color-error)', textAlign: 'center', padding: '3rem' }}>
      Failed to load dashboard: {error}
    </div>
  );

  const statCards = [
    { label: 'Total Claims', value: fmt(summary?.totalClaims), color: 'var(--color-primary)' },
    { label: 'Denied', value: fmt(summary?.deniedCount), color: 'var(--color-error)' },
    { label: 'Denial Rate', value: pct(summary?.denialRate), color: 'var(--color-warning)' },
    { label: 'Financial Impact', value: currency(summary?.deniedAmount), color: 'var(--color-error)' },
    { label: 'Avg Days to Resolve', value: fmt(summary?.avgResolutionDays) + 'd', color: 'var(--color-primary)' },
  ];

  return (
    <div className="page">
      <h2 className="page-title">Dashboard</h2>

      <div className="stat-grid">
        {statCards.map((s, i) => (
          <div key={i} className="card stat-card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <ClaimVolumeChart data={trends} />
        </div>
        <div className="chart-card">
          <DenialRateChart data={trends} />
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <TopDenialReasons reasons={denialReasons} />
        </div>
        <div className="chart-card">
          <FinancialImpact summary={summary} />
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <PayerBreakdown breakdown={payerBreakdown} />
        </div>
        {aging?.length > 0 && (
          <div className="chart-card">
            <div className="card">
              <div className="card-header">Aging Buckets</div>
              <table className="table">
                <thead><tr><th>Bucket</th><th>Claims</th></tr></thead>
                <tbody>
                  {aging.map((a, i) => (
                    <tr key={i}><td>{a.bucket}</td><td>{fmt(a.count)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
