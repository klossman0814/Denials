import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { remittancesApi } from '../services/remittances.api';
import { useDebounce } from '../hooks/useDebounce';

const currency = (v) => v != null ? `$${Number(v).toLocaleString()}` : '—';
const dateFmt = (d) => d ? new Date(d).toLocaleDateString() : '—';

function SummaryCard({ label, value }) {
  return (
    <div className="card stat-card" style={{ cursor: 'default' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{value || '—'}</div>
    </div>
  );
}

export default function Remittances() {
  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);
  const limit = 25;

  useEffect(() => {
    setLoading(true);
    remittancesApi.list({ page, limit, search: debouncedSearch || undefined })
      .then(res => { setFiles(res.data.files); setTotal(res.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search]);

  const totalPayment = files.reduce((s, f) => s + (parseFloat(f.total_payment) || 0), 0);

  return (
    <div className="page">
      <h2 className="page-title">Remittance Files (835)</h2>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: '1rem' }}>
        <SummaryCard label="Total Files" value={total} />
        <SummaryCard label="Total Payments" value={currency(totalPayment)} />
        <SummaryCard label="Search" value={`"${search}"`} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input className="form-input" placeholder="Search by payer, payee, trace number..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: '200px' }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : files.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          No remittance files found. Upload or watch EDI 835 files.
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Payer</th><th>Payee</th><th>Total Payment</th><th>Method</th>
                  <th>Payment Date</th><th>Trace #</th><th>Claims</th><th></th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id}>
                    <td>{f.payer_name || '—'}</td>
                    <td>{f.payee_name || '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{currency(f.total_payment)}</td>
                    <td><span className="badge badge-pending">{f.payment_method || '—'}</span></td>
                    <td>{dateFmt(f.payment_date)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{f.trace_number || '—'}</td>
                    <td>{(f.Remittances || f.claim_count || '—')}</td>
                    <td><Link to={`/remittances/${f.id}`} className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>Prev</button>
              <button className="btn btn-secondary" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
