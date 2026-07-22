import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ClaimVolumeChart({ data }) {
  if (!data?.claimTrends?.length) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No claim volume data yet</div>;
  return (
    <div className="card">
      <div className="card-header">Claim Volume (30 days)</div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data.claimTrends.map(d => ({ date: d.date, Claims: parseInt(d.count) }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <Tooltip />
          <Bar dataKey="Claims" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
