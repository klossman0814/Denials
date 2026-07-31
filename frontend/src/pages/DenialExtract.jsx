import React from 'react';
import api from '../services/api';

export default function DenialExtract() {
  const downloadCsv = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/denial-extract', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      alert('Failed to generate extract');
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `denial-extract-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const [fieldCount, setFieldCount] = React.useState(0);
  React.useEffect(() => {
    api.get('/denial-extract/count').then(r => setFieldCount(r.data.count)).catch(() => {});
  }, []);

  return (
    <div className="page">
      <h2 className="page-title">Denial Extract</h2>
      <div className="card" style={{ maxWidth: '640px', padding: '1.5rem' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Download all denial records as a CSV file with {fieldCount ? fieldCount.toLocaleString() : 'all'} columns including
          patient, claim, provider, payer, diagnosis, and denial reason data.
        </p>
        <button className="btn btn-primary" onClick={downloadCsv} style={{ fontSize: '0.9rem', padding: '0.5rem 1.25rem' }}>
          ⬇ Download Denial Extract (CSV)
        </button>
        <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Includes PHI (patient names, DOB, member IDs). Handle per your organization's data security policy.
        </div>
      </div>
    </div>
  );
}
