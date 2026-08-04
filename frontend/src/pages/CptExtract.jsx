import React, { useState } from 'react';
import api from '../services/api';

export default function CptExtract() {
  const [codesText, setCodesText] = useState('');
  const [matchMode, setMatchMode] = useState('exact');
  const [directory, setDirectory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  const startExport = async () => {
    setError('');
    const codes = codesText.split(/[\n,;\s]+/).map(c => c.trim().toUpperCase()).filter(Boolean);
    if (codes.length === 0) { setError('Enter at least one CPT/HCPCS code.'); return; }
    if (!directory.trim()) { setError('Enter a directory name.'); return; }

    setSubmitting(true);
    try {
      const res = await api.post('/export/by-procedure', {
        codes, matchMode, directory: directory.trim(),
      });
      setJobId(res.data.jobId);
      setStatus({ state: 'running', progress: null });
      pollJob(res.data.jobId);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to start export');
      setSubmitting(false);
    }
  };

  const pollJob = async (id) => {
    try {
      const res = await api.get(`/export/jobs/${id}`);
      const j = res.data;
      if (j.status === 'done' || j.status === 'error') {
        setStatus({ state: j.status, ...j });
        setSubmitting(false);
      } else {
        setStatus({ state: 'running', progress: j.progress });
        setTimeout(() => pollJob(id), 2000);
      }
    } catch (e) {
      setStatus({ state: 'error', error: 'Failed to poll job' });
      setSubmitting(false);
    }
  };

  const fmt = (n) => n != null ? Number(n).toLocaleString() : '—';

  return (
    <div className="page">
      <h2 className="page-title">CPT/HCPCS Extract</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Export every 835 and 837 file that contains the given CPT/HCPCS codes into
        separate <code>835/</code> and <code>837/</code> directories on this server.
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">Export Settings</div>
        <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              CPT/HCPCS Codes
            </label>
            <textarea
              className="form-input"
              rows={6}
              placeholder={'One code per line or comma-separated, e.g.\n99213\nG0101, 85025'}
              value={codesText}
              onChange={e => setCodesText(e.target.value)}
              style={{ width: '100%', fontFamily: 'monospace' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Match Mode</label>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="radio" name="matchMode" checked={matchMode === 'exact'} onChange={() => setMatchMode('exact')} />
                Exact (99213 matches only 99213)
              </label>
              <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="radio" name="matchMode" checked={matchMode === 'prefix'} onChange={() => setMatchMode('prefix')} />
                Prefix (9921 matches 99213, 99214, ...)
              </label>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Directory Name
            </label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Feb-2026-physical-therapy"
              value={directory}
              onChange={e => setDirectory(e.target.value)}
              style={{ width: '100%', maxWidth: '28rem' }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Files are written to <code>C:\Denials\extracts\&lt;directory&gt;\835</code> and <code>\837</code>
            </div>
          </div>

          {error && <div style={{ color: 'var(--color-danger, #d64545)', fontSize: '0.875rem' }}>{error}</div>}

          <div>
            <button className="btn btn-primary" onClick={startExport} disabled={submitting}>
              {submitting ? 'Extracting...' : 'Extract Files'}
            </button>
          </div>
        </div>
      </div>

      {status && (
        <div className="card">
          <div className="card-header">Export Result {jobId ? `(job ${jobId.slice(0, 8)})` : ''}</div>
          <div style={{ padding: '1rem', fontSize: '0.875rem', display: 'grid', gap: '0.75rem' }}>
            {status.state === 'running' && (
              <div>
                <div className="spinner" style={{ marginBottom: '0.5rem' }} />
                <div>
                  Running — copied{' '}
                  <strong>{fmt(status.progress?.done)}</strong> / {fmt(status.progress?.total)} files
                  {status.progress?.current ? ` (${status.progress.current})` : ''}
                </div>
              </div>
            )}

            {status.state === 'error' && (
              <div style={{ color: 'var(--color-danger, #d64545)' }}>Error: {status.error || 'Export failed'}</div>
            )}

            {status.state === 'done' && status.result && (
              <>
                <div><strong>Match mode:</strong> {status.result.matchMode}</div>
                <div><strong>Codes:</strong> {status.result.codes.join(', ')}</div>
                <div><strong>Total files exported:</strong> {fmt(status.result.totalFiles)}</div>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div><strong>835 files:</strong> {fmt(status.result.summary?.['835']?.count)}</div>
                  <div><strong>837 files:</strong> {fmt(status.result.summary?.['837']?.count)}</div>
                </div>
                <div><strong>Location:</strong> <code>{status.result.hostPath}</code></div>
                {(status.result.missingOnDisk?.length > 0) && (
                  <div style={{ color: 'var(--color-warning, #b58900)' }}>
                    {status.result.missingOnDisk.length} file(s) skipped (source not found)
                  </div>
                )}
                {status.result.message && <div>{status.result.message}</div>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
