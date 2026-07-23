import React from 'react';

const fmt = (v) => v?.toLocaleString() ?? '—';
const currency = (v) => v != null ? `$${parseFloat(v).toLocaleString()}` : '—';

export default function PayerBreakdown({ breakdown, page, totalPages, onPageChange }) {
  if (!breakdown?.length) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No payer data yet</div>;

  const total = breakdown.reduce((s, p) => s + p.count, 0);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, page - 1);
      let end = Math.min(totalPages - 1, page + 1);
      if (page <= 3) { start = 2; end = Math.min(maxVisible, totalPages - 1); }
      if (page >= totalPages - 2) { start = Math.max(2, totalPages - maxVisible + 1); end = totalPages - 1; }
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
        <button
          className="btn btn-secondary"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          « Prev
        </button>
        {getPageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} style={{ padding: '0 0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>…</span>
          ) : (
            <button
              key={p}
              className="btn"
              style={{
                padding: '0.25rem 0.5rem', fontSize: '0.75rem', minWidth: '28px',
                background: p === page ? 'var(--color-primary)' : 'var(--bg-card)',
                color: p === page ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                ...(p === page ? { borderColor: 'var(--color-primary)' } : {}),
              }}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          className="btn btn-secondary"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next »
        </button>
      </div>
    </div>
  );
}
