import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#8b5cf6', '#06b6d4'];

export default function PayerBreakdown({ breakdown }) {
  if (!breakdown?.length) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No payer data yet</div>;
  return (
    <div className="card">
      <div className="card-header">Claims by Payer</div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={breakdown} dataKey="count" nameKey="payer" cx="50%" cy="50%" outerRadius={100}
            label={({ payer, percent }) => `${payer} (${(percent * 100).toFixed(0)}%)`}>
            {breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
