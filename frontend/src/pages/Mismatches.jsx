import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { mismatchesApi } from '../services/mismatches.api';
import StatusBadge from '../components/StatusBadge';
import { useDebounce } from '../hooks/useDebounce';

const currency = (v) => v != null ? `$${Number(v).toLocaleString()}` : '—';

export default function Mismatches() {
  const [data, setData] = useState({ claimsNo835: [], remitsNo837: [], claimsNo835Total: 0, remitsNo837Total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    mismatchesApi.list({ page, limit, search: debouncedSearch }).then(res => {
      setData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  const totalPages = Math.ceil(Math.max(data.claimsNo835Total, data.remitsNo837Total) / limit);

  return (
    <div className="page">
      <h2 className="page-title">Mismatched Claims & Remittances</h2>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search by patient name, claim ID, member ID..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: '200px' }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : (
        <>
          {/* Claims without 835 */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              Claims Without 835 Remittance
              <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--color-error)', fontWeight: 600 }}>
                ({data.claimsNo835Total.toLocaleString()} total)
              </span>
            </div>
            {data.claimsNo835.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem' }}>No unmatched claims found.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Claim ID</th><th>Patient</th><th>Payer</th><th>Status</th><th>Charges</th><th>Service Date</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.claimsNo835.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{c.claim_id}</td>
                      <td>{`${c.patient_first_name || ''} ${c.patient_last_name || ''}`.trim() || '—'}</td>
                      <td>{c.payer_name || '—'}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>{currency(c.total_charge)}</td>
                      <td>{c.service_date_start ? new Date(c.service_date_start).toLocaleDateString() : (c.service_date_end ? new Date(c.service_date_end).toLocaleDateString() : '—')}</td>
                      <td><Link to={`/claims/${c.id}`} className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Remittances without 837 */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              Remittances Without 837 Claim
              <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--color-warning)', fontWeight: 600 }}>
                ({data.remitsNo837Total.toLocaleString()} total)
              </span>
            </div>
            {data.remitsNo837.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem' }}>No unmatched remittances found.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th><th>Payer</th><th>Claim ID</th><th>Charges</th><th>Paid</th><th>Payment Date</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.remitsNo837.map(r => (
                    <tr key={r.id}>
                      <td>{`${r.patient_first_name || ''} ${r.patient_last_name || ''}`.trim() || '—'}</td>
                      <td>{r.remittance_file?.payer_name || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{r.payer_claim_id || '—'}</td>
                      <td>{currency(r.total_charge)}</td>
                      <td>{currency(r.total_paid)}</td>
                      <td>{r.remittance_date ? new Date(r.remittance_date).toLocaleDateString() : (r.remittance_file?.payment_date ? new Date(r.remittance_file.payment_date).toLocaleDateString() : '—')}</td>
                      <td><Link to={`/remittances/${r.remittance_file_id}`} className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages}
              </span>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>Prev</button>
                <button className="btn btn-secondary" disabled={page * limit >= Math.max(data.claimsNo835Total, data.remitsNo837Total)} onClick={() => setPage(p => p + 1)}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
