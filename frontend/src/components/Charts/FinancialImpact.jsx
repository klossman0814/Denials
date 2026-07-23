import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatCurrency = (v) => `$${v.toLocaleString()}`;
const formatAxisCurrency = (v) => {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
};

export default function FinancialImpact({ summary }) {
  if (!summary) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No financial data yet</div>;
  const data = [
    { metric: 'Charges', Amount: summary.totalCharges, fill: 'var(--color-primary)' },
    { metric: 'Payments', Amount: summary.totalPayments, fill: 'var(--color-success)' },
    { metric: 'Adjustments', Amount: summary.totalAdjustments, fill: 'var(--color-warning)' },
  ];
  return (
    <div className="card">
      <div className="card-header">Financial Impact</div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={formatAxisCurrency} />
          <Tooltip
            formatter={(v) => formatCurrency(v)}
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
            }}
            labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
          />
          <Bar dataKey="Amount" radius={[4, 4, 0, 0]}>
            {data.map((e, i) => <rect key={i} fill={e.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
