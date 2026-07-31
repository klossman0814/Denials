import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function DenialExtract() {
  const [fieldCount, setFieldCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/denial-extract/count').then(r => setFieldCount(r.data.count)).catch(() => {});
  }, []);

  const downloadCsv = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/denial-extract', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `denial-extract-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error('Extract download failed:', err);
      setError(err.response?.data?.error || err.message || 'Download failed. Check the console or try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h2 className="page-title">Denial Extract</h2>
      <div className="card" style={{ maxWidth: '640px', padding: '1.5rem' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Download all denial records as a CSV file with {fieldCount ? fieldCount.toLocaleString() : 'all'} columns including
          patient, claim, provider, payer, diagnosis, and denial reason data.
        </p>
        <button
          className="btn btn-primary"
          onClick={downloadCsv}
          disabled={loading}
          style={{ fontSize: '0.9rem', padding: '0.5rem 1.25rem' }}
        >
          {loading ? '⏳ Generating extract... this can take a minute' : '⬇ Download Denial Extract (CSV)'}
        </button>
        {error && (
          <div style={{ marginTop: '1rem', padding: '0.5rem 0.75rem', background: 'var(--color-error)', color: '#fff', borderRadius: '4px', fontSize: '0.8rem' }}>
            {error}
          </div>
        )}
        <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Includes PHI (patient names, DOB, member IDs). Handle per your organization's data security policy. Admin access required.
        </div>
      </div>
    </div>
  );
}
