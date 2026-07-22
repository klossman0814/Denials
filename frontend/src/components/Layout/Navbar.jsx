import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="navbar">
      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Insurance Denials System</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={toggleTheme} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{user?.username}</span>
        <button onClick={logout} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Sign Out</button>
      </div>
    </header>
  );
}
