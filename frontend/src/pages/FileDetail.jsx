import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { uploadApi } from '../services/upload.api';
import StatusBadge from '../components/StatusBadge';

export default function FileDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    uploadApi.getFileById(id).then(res => {
      setData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}><div className="spinner" /></div>;
  if (!data) return <div className="page"><p>File not found.</p></div>;

  const { file, claims, remittances } = data;

  return (
    <div className="page">
      <Link to="/upload" style={{ fontSize: '0.875rem', color: 'var(--color-primary)', marginBottom: '1rem', display: 'inline-block' }}>&larr; Back to Files</Link>
      <h2 className="page-title" style={{ fontFamily: 'monospace' }}>{file.filename}</h2>

      <div className="chart-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">File Info</div>
          <table className="table">
            <tbody>
              <tr><td style={{ fontWeight: 600 }}>Type</td><td>{file.file_type}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Status</td><td><StatusBadge status={file.status} /></td></tr>
              <tr><td style={{ fontWeight: 600 }}>Uploaded</td><td>{file.uploaded_at ? new Date(file.uploaded_at).toLocaleString() : '—'}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Size</td><td>{file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : '—'}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Content Hash</td><td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{file.content_hash || '—'}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">Correction Chain</div>
          <table className="table">
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Supersedes</td>
                <td>
                  {file.Supersedes ? (
                    <Link to={`/files/${file.Supersedes.id}`}>{file.Supersedes.filename}</Link>
                  ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Superseded By</td>
                <td>
                  {file.SupersededBy ? (
                    <Link to={`/files/${file.SupersededBy.id}`}>{file.SupersededBy.filename}</Link>
                  ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {claims.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">Claims ({claims.length})</div>
          <table className="table">
            <thead><tr><th>Claim ID</th><th>Patient</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {claims.map(c => (
                <tr key={c.id}>
                  <td><Link to={`/claims/${c.id}`} style={{ fontFamily: 'monospace' }}>{c.claim_id}</Link></td>
                  <td>{c.patient_first_name} {c.patient_last_name}</td>
                  <td>${c.total_charge || '0'}</td>
                  <td><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {remittances.length > 0 && (
        <div className="card">
          <div className="card-header">Remittances ({remittances.length})</div>
          <table className="table">
            <thead><tr><th>Claim ID</th><th>Patient</th><th>Paid</th><th>Status</th></tr></thead>
            <tbody>
              {remittances.map(r => (
                <tr key={r.id}>
                  <td><Link to={`/remittances/${r.id}`} style={{ fontFamily: 'monospace' }}>{r.payer_claim_id}</Link></td>
                  <td>{r.patient_name}</td>
                  <td>${r.total_paid || '0'}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
