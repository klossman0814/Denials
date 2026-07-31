import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/claims', label: 'Claims', icon: '📋' },
  { path: '/denials', label: 'Denials', icon: '🚫' },
  { path: '/remittances', label: 'Remittances', icon: '💳' },
  { path: '/upload', label: 'Upload Files', icon: '📤' },
  { path: '/mismatches', label: 'Mismatches', icon: '⚠️' },
  { path: '/matched-claims', label: 'Matched', icon: '✅' },
  { path: '/executive-summary', label: 'Executive', icon: '📊' },
  { path: '/denial-extract', label: 'Extract', icon: '📥' },
  { path: '/admin', label: 'Admin', icon: '⚙️', adminOnly: true },
];

export default function Sidebar({ user }) {
  return (
    <aside className="sidebar">
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '0.875rem', color: 'var(--color-primary)' }}>Denials Manager</h3>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
        {navItems.filter(i => !i.adminOnly || user?.role === 'admin').map(item => (
          <NavLink key={item.path} to={item.path}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
              borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500,
              color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--color-primary-shadow)' : 'transparent',
              textDecoration: 'none',
            })}>
            <span>{item.icon}</span><span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {user?.username}<br /><span style={{ textTransform: 'capitalize' }}>{user?.role}</span>
        </div>
      </div>
    </aside>
  );
}
