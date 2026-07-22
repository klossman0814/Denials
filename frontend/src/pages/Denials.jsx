import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { denialsApi } from '../services/denials.api';
import StatusBadge from '../components/StatusBadge';

const currency = (v) => v != null ? `$${Number(v).toLocaleString()}` : '—';

function SummaryCard({ label, value, sub }) {
  return (
    <div className="card stat-card" style={{ cursor: 'default' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );
}

export default function Denials() {
  const navigate = useNavigate();
  const [denials, setDenials] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [denialCode, setDenialCode] = useState('');
  const [payer, setPayer] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    setLoading(true);
    denialsApi.list({ page, limit, search: search || undefined, denial_code: denialCode || undefined, payer: payer || undefined, status: status || undefined })
      .then(res => {
        setDenials(res.data.denials);
        setSummary(res.data.summary);
        setTotal(res.data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, denialCode, payer, status]);

  const handleRowClick = (claimId) => {
    if (claimId) navigate(`/claims/${claimId}`);
  };

  return (
    <div className="page">
      <h2 className="page-title">Denials</h2>

      {/* Summary Stats */}
      {summary && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: '1rem' }}>
          <SummaryCard label="Total Denials" value={summary.totalDenials?.toLocaleString()} sub={`${total} shown`} />
          <SummaryCard label="Total Denied $" value={currency(summary.totalDeniedAmount)} />
          <SummaryCard label="Unique Codes" value={summary.uniqueCodes} />
          <SummaryCard label="Payers Affected" value={summary.payersAffected} />
          <SummaryCard label={`Top Code: ${summary.topCode?.code || '—'}`} value={summary.topCode?.count?.toLocaleString() || '—'} sub={summary.topCode ? 'occurrences' : ''} />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="Search code, reason, patient, claim..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: '200px' }} />
        <input className="form-input" placeholder="Denial Code"
          value={denialCode} onChange={(e) => { setDenialCode(e.target.value); setPage(1); }}
          style={{ width: '140px' }} />
        <input className="form-input" placeholder="Payer"
          value={payer} onChange={(e) => { setPayer(e.target.value); setPage(1); }}
          style={{ width: '160px' }} />
        <select className="form-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          style={{ width: '140px' }}>
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="paid">Paid</option>
          <option value="denied">Denied</option>
          <option value="partial">Partial</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : denials.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          No denials found. Upload EDI 835 files to see denial data.
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th><th>Reason</th><th>Amount</th><th>Patient</th>
                  <th>Payer</th><th>Claim ID</th><th>Status</th>
                  <th>Service Date</th><th>Procedure</th><th>Group</th>
                </tr>
              </thead>
              <tbody>
                {denials.map((d) => (
                  <tr key={d.id}
                    onClick={() => handleRowClick(d.claimId)}
                    style={{ cursor: 'pointer' }}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{d.denialCode}</td>
                    <td title={d.reasonDescription || ''} style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.reasonDescription || '—'}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{currency(d.amount)}</td>
                    <td>{d.patientName || '—'}</td>
                    <td>{d.payerName || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{d.claimNumber || '—'}</td>
                    <td><StatusBadge status={d.claimStatus} /></td>
                    <td>{d.serviceDateStart ? new Date(d.serviceDateStart).toLocaleDateString() : '—'}</td>
                    <td style={{ fontFamily: 'monospace' }}>{d.procedureCode || '—'}</td>
                    <td>{d.groupCode ? <span className="badge badge-pending">{d.groupCode}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
