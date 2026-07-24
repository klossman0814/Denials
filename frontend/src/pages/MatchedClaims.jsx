import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { matchedClaimsApi } from '../services/matchedClaims.api';
import StatusBadge from '../components/StatusBadge';
import { useDebounce } from '../hooks/useDebounce';

const currency = (v) => v != null ? `$${Number(v).toLocaleString()}` : '—';
const fmt = (v) => v != null ? Number(v).toLocaleString() : '—';

export default function MatchedClaims() {
  const [claims, setClaims] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    matchedClaimsApi.list({ page, limit, search: debouncedSearch }).then(res => {
      setClaims(res.data.claims);
      setTotal(res.data.total);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  return (
    <div className="page">
      <h2 className="page-title">Matched Claims (837 → 835)</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Claims that have at least one matching 835 remittance. Click <strong>Analysis</strong> for full detail.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search by patient, claim ID, payer..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: '200px' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
          {fmt(total)} matched
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : claims.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          No matched claims found.
        </div>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Claim ID</th><th>Patient</th><th>Payer</th><th>Status</th>
                <th>Charges</th><th>Paid</th><th>Remits</th><th>Denials</th><th>Last Remit Date</th><th></th>
              </tr>
            </thead>
            <tbody>
              {claims.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{c.claim_id}</td>
                  <td>{`${c.patient_first_name || ''} ${c.patient_last_name || ''}`.trim() || '—'}</td>
                  <td>{c.payer_name || '—'}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{currency(c.total_charge)}</td>
                  <td>{currency(c.total_paid)}</td>
                  <td>{fmt(c.remittance_count)}</td>
                  <td>{fmt(c.denialCount)} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({currency(c.denialTotal)})</span></td>
                  <td>{c.last_remittance_date ? new Date(c.last_remittance_date).toLocaleDateString() : '—'}</td>
                  <td>
                    <Link to={`/claims/${c.id}`} className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                      Analysis
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {fmt(total)}
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
