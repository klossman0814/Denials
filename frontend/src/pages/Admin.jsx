import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');
  const [settings, setSettings] = useState({});
  const [editing, setEditing] = useState(null); // '837' | '835' | null
  const [editValues, setEditValues] = useState({});
  const [settingsMessage, setSettingsMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/admin/users').then(r => setUsers(r.data.users)).catch(() => setUsers([])),
      api.get('/upload/files').then(r => setFiles(r.data.files || [])).catch(() => setFiles([])),
      api.get('/admin/settings').then(r => {
        setSettings(r.data.settings);
        setEditValues(r.data.settings);
      }).catch(() => setSettings({})),
    ]).finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleActiveToggle = async (userId, currentActive) => {
    try {
      await api.put(`/admin/users/${userId}/active`, { active: !currentActive });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, active: !currentActive } : u));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to toggle active status');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${username}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleDelete = async (type) => {
    const label = type === '837' ? '837 claims' : '835 remittances';
    if (!window.confirm(`Are you sure you want to delete ALL ${label} data? This cannot be undone.`)) return;
    setDeleting(type);
    setDeleteMessage('');
    try {
      const res = await api.delete(`/admin/data/${type}`);
      setDeleteMessage(res.data.message || `All ${label} data deleted.`);
      // Refresh file list
      api.get('/upload/files').then(r => setFiles(r.data.files || [])).catch(() => setFiles([]));
    } catch (err) {
      setDeleteMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setDeleting('');
    }
  };

  const handleClearFiles = async () => {
    if (!window.confirm('Are you sure you want to clear all uploaded file records? The claims/remittances data will remain but the file history will be lost. This cannot be undone.')) return;
    setDeleting('files');
    setDeleteMessage('');
    try {
      const res = await api.delete('/admin/files');
      setDeleteMessage(res.data.message || 'Uploaded files list cleared.');
      setFiles([]);
    } catch (err) {
      setDeleteMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setDeleting('');
    }
  };

  const handleStartEdit = (type) => {
    setEditing(type);
    setEditValues(prev => ({ ...prev, [type === '837' ? 'upload_dir_837' : 'upload_dir_835']: settings[type === '837' ? 'upload_dir_837' : 'upload_dir_835'] || '' }));
    setSettingsMessage('');
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setEditValues({...settings});
    setSettingsMessage('');
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSettingsMessage('');
    try {
      const payload = {};
      if (editValues.upload_dir_837 !== undefined) payload.upload_dir_837 = editValues.upload_dir_837;
      if (editValues.upload_dir_835 !== undefined) payload.upload_dir_835 = editValues.upload_dir_835;
      const res = await api.put('/admin/settings', payload);
      setSettings(res.data.settings);
      setEditValues(res.data.settings);
      setEditing(null);
      const msg = res.data.warning
        ? `Saved with warning: ${res.data.warning}`
        : 'File drop locations updated.';
      setSettingsMessage(msg);
      setTimeout(() => setSettingsMessage(''), 5000);
    } catch (err) {
      setSettingsMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page" style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" /></div>;

  return (
    <div className="page">
      <h2 className="page-title">Admin Panel</h2>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">Users</div>
        {users.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem' }}>No users found.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.active === false ? 0.5 : 1 }}>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td><span style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                  <td>
                    <button
                      className={`btn btn-sm ${u.active !== false ? 'btn-success' : ''}`}
                      onClick={() => handleActiveToggle(u.id, u.active !== false)}
                      style={{
                        fontSize: '0.7rem', padding: '0.15rem 0.5rem',
                        background: u.active !== false ? 'var(--color-success)' : 'var(--color-error)',
                        color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer',
                      }}
                    >
                      {u.active !== false ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select className="form-input" value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      style={{ width: '100px', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => handleDeleteUser(u.id, u.username)}
                      style={{
                        fontSize: '0.75rem', padding: '0.15rem 0.5rem',
                        background: 'var(--color-error)', color: '#fff',
                        border: 'none', borderRadius: '4px', cursor: 'pointer',
                      }}
                      title="Delete user"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* File Drop Locations */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">File Drop Locations</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', padding: '0 1rem' }}>
          Configure the directories where 837 and 835 files are dropped for automatic processing.
        </p>
        <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { type: '837', label: '837 Claim Files', key: 'upload_dir_837' },
            { type: '835', label: '835 Remittance Files', key: 'upload_dir_835' },
          ].map(({ type, label, key }) => (
            <div key={type}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>{label}</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {editing === type ? (
                  <>
                    <input
                      className="form-input"
                      type="text"
                      value={editValues[key] || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                      style={{ flex: 1 }}
                      placeholder={`Enter ${type} directory path`}
                    />
                    <button className="btn btn-sm btn-primary" onClick={handleSaveSettings} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="btn btn-sm" onClick={handleCancelEdit} disabled={saving}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <code style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '0.85rem' }}>
                      {settings[key] || '(not configured)'}
                    </code>
                    <button className="btn btn-sm" onClick={() => handleStartEdit(type)}>Edit</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {settingsMessage && (
            <div style={{
              fontSize: '0.85rem', padding: '0.5rem', borderRadius: '4px',
              color: settingsMessage.includes('Error') ? 'var(--color-error)'
                   : settingsMessage.includes('warning') ? 'var(--color-warning, #b8860b)'
                   : 'var(--color-success)',
              background: settingsMessage.includes('Error') ? 'var(--bg-error, rgba(220,38,38,0.1))'
                        : settingsMessage.includes('warning') ? 'var(--bg-warning, rgba(184,134,11,0.1))'
                        : 'var(--bg-success, rgba(34,197,94,0.1))',
            }}>
              {settingsMessage}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">System Status</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Total Users', value: users.length },
            { label: 'Total Files Uploaded', value: files.length },
            { label: 'Database', value: 'PostgreSQL :5442' },
            { label: 'Environment', value: import.meta.env.VITE_NODE_ENV || 'development' },
          ].map((s, i) => (
            <div key={i} className="card stat-card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Management */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">Data Management</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', padding: '0 1rem' }}>
          These actions permanently delete data. They cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '0 1rem 1rem' }}>
          <button
            className="btn btn-danger"
            onClick={() => handleDelete('837')}
            disabled={deleting === '837'}
          >
            {deleting === '837' ? 'Deleting...' : 'Delete All 837 Data'}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => handleDelete('835')}
            disabled={deleting === '835'}
          >
            {deleting === '835' ? 'Deleting...' : 'Delete All 835 Data'}
          </button>
          <button
            className="btn btn-danger"
            onClick={handleClearFiles}
            disabled={deleting === 'files'}
          >
            {deleting === 'files' ? 'Clearing...' : 'Clear Uploaded Files List'}
          </button>
        </div>
        {deleteMessage && (
          <div style={{ padding: '0 1rem 1rem', fontSize: '0.875rem', color: deleteMessage.includes('Error') ? 'var(--color-error)' : 'var(--color-success)' }}>
            {deleteMessage}
          </div>
        )}
      </div>
    </div>
  );
}
