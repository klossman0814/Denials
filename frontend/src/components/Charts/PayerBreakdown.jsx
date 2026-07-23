import React from 'react';

const fmt = (v) => v?.toLocaleString() ?? '—';
const currency = (v) => v != null ? `$${parseFloat(v).toLocaleString()}` : '—';

export default function PayerBreakdown({ breakdown }) {
  if (!breakdown?.length) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No payer data yet</div>;

  const total = breakdown.reduce((s, p) => s + p.count, 0);

  return (
    <div className="card">
      <div className="card-header">Claims by Payer</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Payer</th>
              <th style={{ textAlign: 'right' }}>Claims</th>
              <th style={{ textAlign: 'right' }}>% of Total</th>
              <th style={{ textAlign: 'right' }}>Total Charges</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((p, i) => (
              <tr key={i}>
                <td>{p.payer}</td>
                <td style={{ textAlign: 'right' }}>{fmt(p.count)}</td>
                <td style={{ textAlign: 'right' }}>{total > 0 ? `${(p.count / total * 100).toFixed(1)}%` : '—'}</td>
                <td style={{ textAlign: 'right' }}>{currency(p.totalCharge)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
