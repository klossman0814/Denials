import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const currency = (v) => v != null ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const fmt = (v) => v != null ? Number(v).toLocaleString() : '—';
const pct = (v) => v != null ? `${v.toFixed(1)}%` : '—';

const tooltipStyle = {
  contentStyle: {
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem',
  },
  labelStyle: { color: 'var(--text-secondary)', fontWeight: 600 },
};

export default function ExecutiveSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/executive-summary').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page" style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" /></div>;
  if (!data) return <div className="page"><p>No data available.</p></div>;

  const { kpi, monthlyRevenue, payerScorecard, topDenials, agingSummary } = data;

  const formatTooltip = (v) => currency(v);

  return (
    <div className="page">
      <h2 className="page-title">Executive Summary</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        High-level revenue cycle performance overview
      </p>

      {/* === KPI Cards === */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Charges</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)' }}>{currency(kpi.totalCharges)}</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Payments</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-success)' }}>{currency(kpi.totalPayments)}</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Revenue</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-warning)' }}>{currency(kpi.netRevenue)}</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: '4px solid ' + (kpi.collectionRate > 80 ? 'var(--color-success)' : kpi.collectionRate > 50 ? 'var(--color-warning)' : 'var(--color-error)') }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collection Rate</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{pct(kpi.collectionRate)}</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: '4px solid ' + (kpi.denialRate < 5 ? 'var(--color-success)' : kpi.denialRate < 10 ? 'var(--color-warning)' : 'var(--color-error)') }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Denial Rate</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{pct(kpi.denialRate)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{fmt(kpi.deniedCount)} denied of {fmt(kpi.totalClaims)} claims</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Match Rate</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{pct(kpi.matchRate)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{fmt(kpi.totalRemittances)} remittances</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Days to Resolve</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{fmt(kpi.avgDaysToResolve)}d</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--color-error)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Denied Amount</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-error)' }}>{currency(kpi.deniedAmount)}</div>
        </div>
      </div>

      {/* === Monthly Revenue Trends === */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">Monthly Revenue Trends (12 Months)</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyRevenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
            <Tooltip formatter={formatTooltip} {...tooltipStyle} />
            <Bar dataKey="total_charges" name="Charges" fill="var(--color-primary)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="total_payments" name="Payments" fill="var(--color-success)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="total_adjustments" name="Adjustments" fill="var(--color-warning)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* === Two Column: Payer Scorecard + Denial Impact === */}
      <div className="chart-grid" style={{ marginTop: '1.5rem' }}>
        <div className="card">
          <div className="card-header">Top Payers by Charges</div>
          <div className="table-responsive">
            <table className="table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr><th>Payer</th><th>Claims</th><th>Charges</th><th>Payments</th><th>Avg Days</th></tr>
              </thead>
              <tbody>
                {payerScorecard.map((p, i) => (
                  <tr key={i}>
                    <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.payer_name || '—'}</td>
                    <td>{fmt(p.claim_count)}</td>
                    <td>{currency(p.total_charges)}</td>
                    <td>{currency(p.total_payments)}</td>
                    <td>{p.avg_days_to_resolve != null ? fmt(Math.round(p.avg_days_to_resolve)) + 'd' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Top Denial Codes by Amount</div>
          <div className="table-responsive">
            <table className="table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr><th>Code</th><th>Count</th><th>Total Amount</th></tr>
              </thead>
              <tbody>
                {topDenials.map((d, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace' }}>{d.code}</td>
                    <td>{fmt(d.count)}</td>
                    <td style={{ color: 'var(--color-error)' }}>{currency(d.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* === AR Aging Summary === */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">AR Aging Summary</div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={agingSummary} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
            <YAxis dataKey="bucket" type="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={80} />
            <Tooltip formatter={formatTooltip} {...tooltipStyle} />
            <Bar dataKey="total_charge" name="Total Charges" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ marginTop: '0.5rem' }}>
          <table className="table" style={{ fontSize: '0.8rem' }}>
            <thead><tr><th>Bucket</th><th>Claims</th><th>Total Charges</th></tr></thead>
            <tbody>
              {agingSummary.map((a, i) => (
                <tr key={i}><td>{a.bucket}</td><td>{fmt(a.count)}</td><td>{currency(a.total_charge)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* === Efficiency Metrics === */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginTop: '1.5rem' }}>
        <div className="card stat-card">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Remittances</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{fmt(kpi.totalRemittances)}</div>
        </div>
        <div className="card stat-card">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matched Remittances</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{fmt(kpi.matchedRemittances)}</div>
        </div>
        <div className="card stat-card">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Denied Amount</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-error)' }}>{currency(kpi.deniedAmount)}</div>
        </div>
        <div className="card stat-card">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Revenue</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-success)' }}>{currency(kpi.netRevenue)}</div>
        </div>
      </div>
    </div>
  );
}
