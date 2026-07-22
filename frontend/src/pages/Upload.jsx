import React, { useState, useEffect, useCallback } from 'react';
import { uploadApi } from '../services/upload.api';
import FileUploadZone from '../components/FileUploadZone';
import StatusBadge from '../components/StatusBadge';

export default function Upload() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  const fetchFiles = useCallback(() => {
    setLoading(true);
    uploadApi.listFiles({ page, limit }).then(res => { setFiles(res.data.files || []); setTotal(res.data.total); }).catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchFiles(); }, [fetchFiles, page]);

  const handleUpload = async (type, file) => {
    setUploading(file.name);
    setUploadResult(null);
    try {
      const res = await uploadApi.upload(type, file);
      setUploadResult({ success: true, file: res.data.file, message: res.data.message || 'File uploaded and processed successfully.' });
      fetchFiles();
    } catch (err) {
      setUploadResult({ success: false, message: err.response?.data?.error || err.message });
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="page">
      <h2 className="page-title">Upload Files</h2>

      {uploadResult && (
        <div style={{
          background: uploadResult.success ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
          color: uploadResult.success ? 'var(--color-success)' : 'var(--color-error)',
          padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.875rem',
        }}>
          {uploadResult.message}
        </div>
      )}

      <div className="chart-grid" style={{ marginBottom: '2rem' }}>
        <div>
          <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>EDI 837 (Claims)</h3>
          <FileUploadZone
            label={uploading ? `Uploading ${uploading}...` : 'Drag & drop an 837 file here'}
            accept=".edi,.837,.txt,.bak"
            onUpload={(file) => handleUpload('837', file)}
          />
        </div>
        <div>
          <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>EDI 835 (Payments)</h3>
          <FileUploadZone
            label={uploading ? `Uploading ${uploading}...` : 'Drag & drop an 835 file here'}
            accept=".edi,.835,.txt,.dat"
            onUpload={(file) => handleUpload('835', file)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">Uploaded Files</div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>
        ) : files.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>No files uploaded yet.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Filename</th><th>Type</th><th>Status</th><th>Uploaded</th></tr></thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{f.filename}</td>
                  <td>{f.file_type}</td>
                  <td><StatusBadge status={f.status} /></td>
                  <td style={{ fontSize: '0.8125rem' }}>{f.uploaded_at ? new Date(f.uploaded_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > limit && (
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
          )}
        )}
      </div>
    </div>
  );
}
