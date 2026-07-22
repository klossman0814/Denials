import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DenialRateChart({ data }) {
  if (!data?.denialTrends?.length) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No denial trend data yet</div>;
  return (
    <div className="card">
      <div className="card-header">Denial Trends (30 days)</div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data.denialTrends.map(d => ({ date: d.date, Denials: parseInt(d.count) }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <Tooltip />
          <Line type="monotone" dataKey="Denials" stroke="var(--color-error)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
