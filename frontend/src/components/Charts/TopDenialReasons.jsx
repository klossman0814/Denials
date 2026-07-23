import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TopDenialReasons({ reasons }) {
  if (!reasons?.length) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No denial reasons recorded</div>;
  return (
    <div className="card">
      <div className="card-header">Top Denial Reasons</div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={reasons} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis dataKey="code" type="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={80} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
            }}
            labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
          />
          <Bar dataKey="count" fill="var(--color-error)" radius={[0, 4, 4, 0]} name="Count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
