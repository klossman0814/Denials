# Insurance Denials System — Implementation Plan (Part 2: Frontend + Docker)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the React frontend and Docker infrastructure for the Insurance Denials System.

**Architecture:** Vite + React frontend, Nginx-based Docker container, Docker Compose orchestration.

**Tech Stack:** Vite 5, React 18, React Router v6, Axios, Recharts, Nginx, Docker Compose

---

### Task 7: Frontend Scaffolding + Theme System

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/styles/globals.css`
- Create: `frontend/src/styles/theme.css`
- Create: `frontend/src/context/ThemeContext.jsx`
- Create: `frontend/src/hooks/useTheme.js`
- Create: `frontend/src/services/api.js`
- Create: `frontend/src/context/NotificationContext.jsx`
- Create: `frontend/src/test-setup.js`

**Interfaces:** Vite dev server, React app shell with theme system, Axios API client

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "insurance-denials-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1",
    "axios": "^1.7.2",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.1",
    "vitest": "^1.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.5",
    "jsdom": "^24.1.0"
  }
}
```

- [ ] **Step 2: Create `frontend/vite.config.js`**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.js',
  },
});
```

- [ ] **Step 3: Create `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Insurance Denials Management System</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: Create `frontend/src/test-setup.js`**

```javascript
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Create `frontend/src/styles/theme.css`**

```css
:root {
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-primary-shadow: rgba(37, 99, 235, 0.1);
  --color-success: #16a34a;
  --color-success-bg: rgba(22, 163, 74, 0.1);
  --color-error: #dc2626;
  --color-error-bg: rgba(220, 38, 38, 0.1);
  --color-warning: #d97706;
  --color-warning-bg: rgba(217, 119, 6, 0.1);
  --bg-primary: #f8fafc;
  --bg-card: #ffffff;
  --bg-sidebar: #ffffff;
  --bg-navbar: #ffffff;
  --bg-hover: #f1f5f9;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --border-color: #e2e8f0;
}

[data-theme="dark"] {
  --color-primary: #3b82f6;
  --color-primary-hover: #60a5fa;
  --color-primary-shadow: rgba(59, 130, 246, 0.15);
  --color-success: #22c55e;
  --color-success-bg: rgba(34, 197, 94, 0.15);
  --color-error: #ef4444;
  --color-error-bg: rgba(239, 68, 68, 0.15);
  --color-warning: #f59e0b;
  --color-warning-bg: rgba(245, 158, 11, 0.15);
  --bg-primary: #0f172a;
  --bg-card: #1e293b;
  --bg-sidebar: #1e293b;
  --bg-navbar: #1e293b;
  --bg-hover: #334155;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border-color: #334155;
}
```

- [ ] **Step 6: Create `frontend/src/styles/globals.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; -webkit-font-smoothing: antialiased; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background-color: var(--bg-primary); color: var(--text-primary); line-height: 1.5; min-height: 100vh;
}
a { color: var(--color-primary); text-decoration: none; }
a:hover { text-decoration: underline; }
button { cursor: pointer; font-family: inherit; }
input, select, textarea { font-family: inherit; font-size: inherit; }
h1 { font-size: 1.75rem; font-weight: 700; }
h2 { font-size: 1.5rem; font-weight: 600; }

.app-layout { display: flex; min-height: 100vh; }
.sidebar { width: 240px; background: var(--bg-sidebar); border-right: 1px solid var(--border-color); padding: 1rem; display: flex; flex-direction: column; flex-shrink: 0; }
.main-content { flex: 1; display: flex; flex-direction: column; overflow-x: hidden; }
.navbar { height: 56px; background: var(--bg-navbar); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; padding: 0 1.5rem; flex-shrink: 0; }
.page-content { padding: 1.5rem; flex: 1; overflow-y: auto; }

.card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.25rem; }
.card-header { font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; }
.card-value { font-size: 1.75rem; font-weight: 700; }

.btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid transparent; font-size: 0.875rem; font-weight: 500; transition: background 0.15s; }
.btn-primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.btn-primary:hover { opacity: 0.9; }
.btn-secondary { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-color); }
.btn-secondary:hover { background: var(--bg-hover); }

.badge { display: inline-flex; align-items: center; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.badge-paid { background: var(--color-success-bg); color: var(--color-success); }
.badge-denied { background: var(--color-error-bg); color: var(--color-error); }
.badge-partial { background: var(--color-warning-bg); color: var(--color-warning); }
.badge-submitted, .badge-pending { background: var(--bg-hover); color: var(--text-secondary); }

.form-group { margin-bottom: 1rem; }
.form-label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.375rem; color: var(--text-secondary); }
.form-input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 0.875rem; }
.form-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-shadow); }

.grid { display: grid; gap: 1rem; }
.grid-4 { grid-template-columns: repeat(4, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
@media (max-width: 1024px) { .grid-4 { grid-template-columns: repeat(2, 1fr); } .grid-3 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .grid-4, .grid-3, .grid-2 { grid-template-columns: 1fr; } .sidebar { display: none; } }

.login-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--bg-primary); }
.login-card { width: 100%; max-width: 400px; padding: 2rem; }
.login-title { text-align: center; margin-bottom: 1.5rem; }

.toast-container { position: fixed; top: 1rem; right: 1rem; z-index: 1000; display: flex; flex-direction: column; gap: 0.5rem; }
.toast { padding: 0.75rem 1rem; border-radius: 6px; color: #fff; font-size: 0.875rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideIn 0.3s ease; max-width: 360px; }
.toast-success { background: var(--color-success); }
.toast-error { background: var(--color-error); }
.toast-warning { background: var(--color-warning); }
.toast-info { background: var(--color-primary); }
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

.upload-zone { border: 2px dashed var(--border-color); border-radius: 8px; padding: 3rem; text-align: center; cursor: pointer; transition: border-color 0.2s; }
.upload-zone:hover, .upload-zone.dragover { border-color: var(--color-primary); background: var(--color-primary-shadow); }

.data-table { width: 100%; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
.data-table th { background: var(--bg-hover); padding: 0.75rem 1rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); }
.data-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); font-size: 0.875rem; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover { background: var(--bg-hover); }
```

- [ ] **Step 7: Create `frontend/src/context/ThemeContext.jsx`**

```jsx
import React, { createContext, useState, useEffect, useCallback } from 'react';

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme(prev => prev === 'light' ? 'dark' : 'light'), []);
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
```

- [ ] **Step 8: Create `frontend/src/hooks/useTheme.js`**

```javascript
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

- [ ] **Step 9: Create `frontend/src/services/api.js`**

```javascript
import axios from 'axios';

const api = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 10: Create `frontend/src/context/NotificationContext.jsx`**

```jsx
import React, { createContext, useState, useCallback, useContext } from 'react';

const NotificationContext = createContext();

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return (
    <NotificationContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>)}
      </div>
    </NotificationContext.Provider>
  );
}
```

- [ ] **Step 11: Create `frontend/src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import './styles/globals.css';
import './styles/theme.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 12: Create `frontend/src/App.jsx`**

```jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Claims from './pages/Claims';
import ClaimDetail from './pages/ClaimDetail';
import Upload from './pages/Upload';
import Admin from './pages/Admin';
import AppLayout from './components/Layout/AppLayout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user || user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="claims" element={<Claims />} />
        <Route path="claims/:id" element={<ClaimDetail />} />
        <Route path="upload" element={<Upload />} />
        <Route path="admin" element={<AdminRoute><Admin /></AdminRoute>} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 13: Run `cd frontend && npm install`**
Expected: node_modules created

---

### Task 8: Frontend Auth (Login, AuthContext, Protected Routes)

**Files:**
- Create: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/hooks/useAuth.js`
- Create: `frontend/src/services/auth.api.js`
- Create: `frontend/src/pages/Login.jsx`
- Create: `frontend/src/tests/Login.test.jsx`

**Interfaces:** `useAuth()` → `{ user, login, register, logout, loading }`, login page

- [ ] **Step 1: Create `frontend/src/services/auth.api.js`**

```javascript
import api from './api';
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};
```

- [ ] **Step 2: Create `frontend/src/context/AuthContext.jsx`**

```jsx
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/auth.api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authApi.me().then(res => setUser(res.data.user)).catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await authApi.login({ username, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  }, []);

  const register = useCallback(async (data) => {
    const res = await authApi.register(data);
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 3: Create `frontend/src/hooks/useAuth.js`**

```javascript
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

- [ ] **Step 4: Create `frontend/src/pages/Login.jsx`**

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) await register({ username, email, password });
      else await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'An error occurred');
    }
  };

  return (
    <div className="login-page">
      <div className="card login-card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={toggleTheme} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        <h1 className="login-title">{isRegister ? 'Create Account' : 'Sign In'}</h1>
        <p className="card-header" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Insurance Denials Management System</p>

        {error && (
          <div style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input id="username" className="form-input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.875rem', padding: 0 }}>
            {isRegister ? 'Sign in' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/src/tests/Login.test.jsx`**

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Login from '../pages/Login';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';

const mockLogin = vi.fn();
const renderLogin = () => render(
  <BrowserRouter>
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme: vi.fn() }}>
      <AuthContext.Provider value={{ user: null, login: mockLogin, register: vi.fn(), logout: vi.fn(), loading: false }}>
        <Login />
      </AuthContext.Provider>
    </ThemeContext.Provider>
  </BrowserRouter>
);

describe('Login Page', () => {
  it('renders login form', () => {
    renderLogin();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('switches to register mode', () => {
    renderLogin();
    fireEvent.click(screen.getByText('Register'));
    expect(screen.getByText('Create Account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('calls login on form submit', async () => {
    mockLogin.mockResolvedValueOnce({});
    renderLogin();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test123' } });
    fireEvent.click(screen.getByText('Sign In'));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('testuser', 'test123'));
  });
});
```

- [ ] **Step 6: Run `cd frontend && npx vitest run`**
Expected: Login tests pass

---

### Task 9: Frontend Layout (Sidebar, Navbar) + StatusBadge

**Files:**
- Create: `frontend/src/components/Layout/AppLayout.jsx`
- Create: `frontend/src/components/Layout/Sidebar.jsx`
- Create: `frontend/src/components/Layout/Navbar.jsx`
- Create: `frontend/src/components/StatusBadge.jsx`

**Interfaces:** App shell with sidebar navigation and theme toggle

- [ ] **Step 1: Create `frontend/src/components/StatusBadge.jsx`**

```jsx
import React from 'react';

const statusColors = {
  paid: 'badge-paid', denied: 'badge-denied', partial: 'badge-partial',
  submitted: 'badge-submitted', pending: 'badge-pending',
  parsed: 'badge-paid', parsing: 'badge-partial', error: 'badge-denied',
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${statusColors[status?.toLowerCase()] || 'badge-pending'}`}>{status || 'unknown'}</span>;
}
```

- [ ] **Step 2: Create `frontend/src/components/Layout/Sidebar.jsx`**

```jsx
import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/claims', label: 'Claims', icon: '📋' },
  { path: '/upload', label: 'Upload Files', icon: '📤' },
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
```

- [ ] **Step 3: Create `frontend/src/components/Layout/Navbar.jsx`**

```jsx
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
```

- [ ] **Step 4: Create `frontend/src/components/Layout/AppLayout.jsx`**

```jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function AppLayout() {
  const { user } = useAuth();
  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <div className="main-content">
        <Navbar />
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}
```

---

### Task 10: Frontend Dashboard Page

**Files:**
- Create: `frontend/src/services/dashboard.api.js`
- Create: `frontend/src/hooks/useDashboard.js`
- Create: `frontend/src/pages/Dashboard.jsx`
- Create: `frontend/src/components/Charts/ClaimVolumeChart.jsx`
- Create: `frontend/src/components/Charts/DenialRateChart.jsx`
- Create: `frontend/src/components/Charts/TopDenialReasons.jsx`
- Create: `frontend/src/components/Charts/FinancialImpact.jsx`
- Create: `frontend/src/components/Charts/PayerBreakdown.jsx`

**Interfaces:** Full dashboard with 7 KPI widgets

- [ ] **Step 1: Create `frontend/src/services/dashboard.api.js`**

```javascript
import api from './api';
export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  denialReasons: (limit = 10) => api.get(`/dashboard/denial-reasons?limit=${limit}`),
  trends: (days = 30) => api.get(`/dashboard/trends?days=${days}`),
  payerBreakdown: () => api.get('/dashboard/payer-breakdown'),
  aging: () => api.get('/dashboard/aging'),
};
```

- [ ] **Step 2: Create `frontend/src/hooks/useDashboard.js`**

```javascript
import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../services/dashboard.api';

export function useDashboard() {
  const [summary, setSummary] = useState(null);
  const [denialReasons, setDenialReasons] = useState([]);
  const [trends, setTrends] = useState(null);
  const [payerBreakdown, setPayerBreakdown] = useState([]);
  const [aging, setAging] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, dr, t, pb, a] = await Promise.all([
        dashboardApi.summary(), dashboardApi.denialReasons(10),
        dashboardApi.trends(30), dashboardApi.payerBreakdown(), dashboardApi.aging(),
      ]);
      setSummary(s.data); setDenialReasons(dr.data.reasons);
      setTrends(t.data); setPayerBreakdown(pb.data.breakdown); setAging(a.data.aging);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  return { summary, denialReasons, trends, payerBreakdown, aging, loading, error, refetch: fetchAll };
}
```

- [ ] **Step 3: Create `frontend/src/components/Charts/ClaimVolumeChart.jsx`**

```jsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ClaimVolumeChart({ data }) {
  if (!data?.claimTrends?.length) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No claim volume data yet</div>;

  return (
    <div className="card">
      <div className="card-header">Claim Volume (30 days)</div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data.claimTrends.map(d => ({ date: d.date, Claims: parseInt(d.count) }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <Tooltip />
          <Bar dataKey="Claims" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/Charts/DenialRateChart.jsx`**

```jsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DenialRateChart({ data }) {
  if (!data?.denialTrends?.length) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No denial trend data yet</div>;

  return (
    <div className="card">
      <div className="card-header">Denial Trends (30 days)</div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data.denialTrends.map(d => ({ date: d.date, Denials: parseInt(d.count) }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <Tooltip />
          <Line type="monotone" dataKey="Denials" stroke="var(--color-error)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/Charts/TopDenialReasons.jsx`**

```jsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TopDenialReasons({ reasons }) {
  if (!reasons?.length) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No denial reasons recorded</div>;

  return (
    <div className="card">
      <div className="card-header">Top Denial Reasons</div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={reasons} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis dataKey="code" type="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={80} />
          <Tooltip />
          <Bar dataKey="count" fill="var(--color-error)" radius={[0, 4, 4, 0]} name="Count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 6: Create `frontend/src/components/Charts/FinancialImpact.jsx`**

```jsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatCurrency = (v) => `$${v.toLocaleString()}`;

export default function FinancialImpact({ summary }) {
  if (!summary) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No financial data yet</div>;

  const data = [
    { metric: 'Charges', Amount: summary.totalCharges, fill: 'var(--color-primary)' },
    { metric: 'Payments', Amount: summary.totalPayments, fill: 'var(--color-success)' },
    { metric: 'Adjustments', Amount: summary.totalAdjustments, fill: 'var(--color-warning)' },
  ];

  return (
    <div className="card">
      <div className="card-header">Financial Impact</div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={formatCurrency} />
          <Tooltip formatter={(v) => formatCurrency(v)} />
          <Bar dataKey="Amount" radius={[4, 4, 0, 0]}>
            {data.map((e, i) => <rect key={i} fill={e.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 7: Create `frontend/src/components/Charts/PayerBreakdown.jsx`**

```jsx
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#8b5cf6', '#06b6d4'];

export default function PayerBreakdown({ breakdown }) {
  if (!breakdown?.length) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No payer data yet</div>;

  return (
    <div className="card">
      <div className="card-header">Claims by Payer</div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={breakdown} dataKey="count" nameKey="payer" cx="50%" cy="50%" outerRadius={100}
            label={({ payer, percent }) => `${payer} (${(percent * 100).toFixed(0)}%)`}>
            {breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 8: Create `frontend/src/pages/Dashboard.jsx`**

```jsx
import React from 'react';
import { useDashboard } from '../hooks/useDashboard';
import StatusBadge from '../components/StatusBadge';
import ClaimVolumeChart from '../components/Charts/ClaimVolumeChart';
import DenialRateChart from '../components/Charts/DenialRateChart';
import TopDenialReasons from '../components/Charts/TopDenialReasons';
import FinancialImpact from '../components/Charts/FinancialImpact';
import PayerBreakdown from '../components/Charts/PayerBreakdown';

export default function Dashboard() {
  const { summary, denialReasons, trends, payerBreakdown, aging, loading, error, refetch } = useDashboard();

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading dashboard...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-error)' }}>Error: {error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Dashboard</h1>
        <button className="btn btn-secondary" onClick={refetch}>↻ Refresh</button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card"><div className="card-header">Total Claims</div><div className="card-value">{summary?.totalClaims || 0}</div></div>
        <div className="card">
          <div className="card-header">Denial Rate</div>
          <div className="card-value" style={{ color: (summary?.denialRate || 0) > 20 ? 'var(--color-error)' : 'var(--color-success)' }}>{summary?.denialRate || 0}%</div>
        </div>
        <div className="card"><div className="card-header">Total Charges</div><div className="card-value">${(summary?.totalCharges || 0).toLocaleString()}</div></div>
        <div className="card"><div className="card-header">Total Payments</div><div className="card-value" style={{ color: 'var(--color-success)' }}>${(summary?.totalPayments || 0).toLocaleString()}</div></div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>Claim Status Distribution</div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {summary?.statusDistribution?.map(s => (
            <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <StatusBadge status={s.status} /><span style={{ fontWeight: 600 }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <ClaimVolumeChart data={trends} /><DenialRateChart data={trends} />
      </div>
      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <TopDenialReasons reasons={denialReasons} /><PayerBreakdown breakdown={payerBreakdown} />
      </div>
      <FinancialImpact summary={summary} />

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>Aging Analysis</div>
        {aging?.length ? (
          <table className="data-table">
            <thead><tr><th>Patient</th><th>Claim ID</th><th>Status</th><th>Days Aging</th><th>Days to Resolve</th></tr></thead>
            <tbody>
              {aging.slice(0, 10).map(a => (
                <tr key={a.id}>
                  <td>{a.patient}</td><td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{a.claimId}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td style={{ fontWeight: a.daysAging > 60 ? 700 : 400, color: a.daysAging > 60 ? 'var(--color-error)' : 'inherit' }}>{a.daysAging}</td>
                  <td>{a.daysToResolve !== null ? `${a.daysToResolve}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No claims data yet</p>}
      </div>
    </div>
  );
}
```

---

### Task 11: Frontend Claims, Upload, and Admin Pages

**Files:**
- Create: `frontend/src/services/claims.api.js`
- Create: `frontend/src/pages/Claims.jsx`
- Create: `frontend/src/pages/ClaimDetail.jsx`
- Create: `frontend/src/pages/Upload.jsx`
- Create: `frontend/src/pages/Admin.jsx`
- Create: `frontend/src/components/FileUploadZone.jsx`

**Interfaces:** Claims list, claim detail, file upload, admin user management

- [ ] **Step 1: Create `frontend/src/services/claims.api.js`**

```javascript
import api from './api';
export const claimsApi = {
  list: (params) => api.get('/claims', { params }),
  get: (id) => api.get(`/claims/${id}`),
  denials: (id) => api.get(`/claims/${id}/denials`),
};
```

- [ ] **Step 2: Create `frontend/src/pages/Claims.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { claimsApi } from '../services/claims.api';
import StatusBadge from '../components/StatusBadge';

export default function Claims() {
  const [claims, setClaims] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = { page, limit };
    if (status) params.status = status;
    if (search) params.search = search;
    claimsApi.list(params).then(res => { setClaims(res.data.claims); setTotal(res.data.total); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page, status, search]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Claims</h1><span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{total} total</span>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input className="form-input" style={{ maxWidth: '300px' }} placeholder="Search patient, claim ID..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="form-input" style={{ maxWidth: '150px' }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option><option value="paid">Paid</option>
          <option value="denied">Denied</option><option value="partial">Partial</option>
        </select>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>
        : claims.length === 0 ? <div className="card" style={{ textAlign: 'center', padding: '3rem' }}><p>No claims found. Upload an 837 file to get started.</p></div>
        : (
          <>
            <table className="data-table">
              <thead><tr><th>Claim ID</th><th>Patient</th><th>Payer</th><th>Charge</th><th>Service Date</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {claims.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{c.claim_id || '—'}</td>
                    <td>{c.patient_last_name}, {c.patient_first_name}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{c.payer_name || '—'}</td>
                    <td>${parseFloat(c.total_charge || 0).toLocaleString()}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{c.service_date_start || '—'}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td><Link to={`/claims/${c.id}`} style={{ fontSize: '0.8125rem' }}>View →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
                <span style={{ padding: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
                <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/pages/ClaimDetail.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { claimsApi } from '../services/claims.api';
import StatusBadge from '../components/StatusBadge';

export default function ClaimDetail() {
  const { id } = useParams();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    claimsApi.get(id).then(res => setClaim(res.data.claim)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading claim...</div>;
  if (!claim) return <div style={{ textAlign: 'center', padding: '3rem' }}>Claim not found</div>;

  return (
    <div>
      <Link to="/claims" style={{ fontSize: '0.875rem', display: 'inline-block', marginBottom: '1rem' }}>← Back to Claims</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Claim {claim.claim_id || '—'}</h1><StatusBadge status={claim.status} />
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">Patient</div>
          <div style={{ fontWeight: 600 }}>{claim.patient_first_name} {claim.patient_last_name}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>DOB: {claim.patient_dob || '—'} | {claim.patient_gender || '—'}</div>
        </div>
        <div className="card">
          <div className="card-header">Subscriber / Payer</div>
          <div style={{ fontWeight: 600 }}>{claim.payer_name || '—'}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>ID: {claim.subscriber_id || '—'}</div>
        </div>
        <div className="card">
          <div className="card-header">Provider</div>
          <div style={{ fontWeight: 600 }}>{claim.provider_name || '—'}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>NPI: {claim.provider_npi || '—'}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>Financial Summary</div>
        <div className="grid grid-3">
          <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Charge</div><div style={{ fontWeight: 700, fontSize: '1.25rem' }}>${parseFloat(claim.total_charge || 0).toLocaleString()}</div></div>
          <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Service Date</div><div style={{ fontWeight: 600 }}>{claim.service_date_start || '—'}</div></div>
        </div>
      </div>

      {claim.ClaimLines?.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>Service Lines</div>
          <table className="data-table">
            <thead><tr><th>Line</th><th>Procedure</th><th>Charge</th><th>Date</th></tr></thead>
            <tbody>
              {claim.ClaimLines.map(l => (
                <tr key={l.id}>
                  <td>{l.line_number}</td><td>{l.procedure_code || '—'}</td>
                  <td>${parseFloat(l.charge_amount || 0).toLocaleString()}</td><td>{l.service_date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {claim.Remittances?.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>Remittance & Denial Info</div>
          {claim.Remittances.map(r => (
            <div key={r.id} style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                <span>Paid: <strong>${parseFloat(r.total_paid || 0).toLocaleString()}</strong></span>
                <span>Adjusted: <strong>${parseFloat(r.adjustment_amount || 0).toLocaleString()}</strong></span>
                <span><StatusBadge status={r.status} /></span>
              </div>
              {r.DenialReasons?.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-error)', fontWeight: 600, marginBottom: '0.25rem' }}>Denial Reasons:</div>
                  {r.DenialReasons.map(d => (
                    <div key={d.id} style={{ fontSize: '0.8125rem', padding: '0.25rem 0' }}>
                      <code>{d.denial_code}</code> — ${d.amount?.toFixed(2)} {d.reason_description && `— ${d.reason_description}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/FileUploadZone.jsx`**

```jsx
import React, { useRef, useState } from 'react';

export default function FileUploadZone({ onUpload, accept, label }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  };

  return (
    <div
      className={`upload-zone ${dragging ? 'dragover' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</p>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>or click to browse</p>
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0]); }} />
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/src/services/upload.api.js`**

```javascript
import api from './api';

export const uploadApi = {
  upload: (type, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/upload/${type}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  listFiles: () => api.get('/upload/files'),
};
```

- [ ] **Step 6: Create `frontend/src/pages/Upload.jsx`**

```jsx
import React, { useState } from 'react';
import { uploadApi } from '../services/upload.api';
import FileUploadZone from '../components/FileUploadZone';
import StatusBadge from '../components/StatusBadge';
import { useNotifications } from '../context/NotificationContext';

export default function Upload() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const { addToast } = useNotifications();

  const handleUpload = async (type, file) => {
    setLoading(true);
    try {
      const res = await uploadApi.upload(type, file);
      addToast(`File "${file.name}" processed: ${res.data.recordsCreated} records`, 'success');
      const list = await uploadApi.listFiles();
      setFiles(list.data.files);
    } catch (err) {
      addToast(err.response?.data?.error || `Failed to process ${file.name}`, 'error');
    } finally { setLoading(false); }
  };

  const loadFiles = async () => {
    const res = await uploadApi.listFiles();
    setFiles(res.data.files);
  };

  useState(() => { loadFiles(); }, []);

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Upload Files</h1>

      <div className="grid grid-2" style={{ marginBottom: '2rem' }}>
        <div>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>837 Claims Files</h3>
          <FileUploadZone
            label="Drop 837 claim files here"
            accept=".837,.edi,.txt"
            onUpload={(f) => handleUpload('837', f)}
          />
        </div>
        <div>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>835 Remittance Files</h3>
          <FileUploadZone
            label="Drop 835 remittance files here"
            accept=".835,.edi,.txt"
            onUpload={(f) => handleUpload('835', f)}
          />
        </div>
      </div>

      {loading && <p style={{ textAlign: 'center', padding: '1rem' }}>Processing file...</p>}

      <div className="card">
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>Recent Uploads</div>
        {files.length === 0
          ? <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No files uploaded yet</p>
          : (
            <table className="data-table">
              <thead><tr><th>Filename</th><th>Type</th><th>Size</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{f.filename}</td>
                    <td><StatusBadge status={f.file_type} /></td>
                    <td>{(f.file_size / 1024).toFixed(1)} KB</td>
                    <td><StatusBadge status={f.status} /></td>
                    <td style={{ fontSize: '0.8125rem' }}>{new Date(f.uploaded_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create `frontend/src/pages/Admin.jsx`**

```jsx
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useNotifications } from '../context/NotificationContext';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'staff' });
  const { addToast } = useNotifications();

  const loadUsers = async () => {
    const res = await api.get('/admin/users');
    setUsers(res.data.users);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', form);
      addToast(`User ${form.username} created`, 'success');
      setForm({ username: '', email: '', password: '', role: 'staff' });
      loadUsers();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to create user', 'error');
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Admin</h1>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>Create User</div>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="staff">Staff</option><option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Create User</button>
          </form>
        </div>

        <div className="card">
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>Users ({users.length})</div>
          <table className="data-table">
            <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Created</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.username}</td><td style={{ fontSize: '0.8125rem' }}>{u.email}</td>
                  <td><span className={`badge ${u.role === 'admin' ? 'badge-paid' : 'badge-submitted'}`}>{u.role}</span></td>
                  <td style={{ fontSize: '0.8125rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 12: Docker Configuration

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `docker-compose.yml`
- Create: `docker-compose.override.yml` (for dev with hot reload)
- Create: `backend/.dockerignore`
- Create: `frontend/.dockerignore`

**Interfaces:** Full Docker Compose stack with PostgreSQL, backend, frontend

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1
CMD ["node", "src/server.js"]
```

- [ ] **Step 2: Create `backend/.dockerignore`**

```
node_modules
logs
data
.env
.git
tests
```

- [ ] **Step 3: Create `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 4: Create `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

- [ ] **Step 5: Create `frontend/.dockerignore`**

```
node_modules
dist
.git
tests
```

- [ ] **Step 6: Create `docker-compose.yml`**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: denials-db
    ports:
      - "${DB_PORT:-5441}:5432"
    environment:
      POSTGRES_DB: ${DB_NAME:-insurance_denials}
      POSTGRES_USER: ${DB_USER:-denials_user}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-denials_pass}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-denials_user} -d ${DB_NAME:-insurance_denials}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    container_name: denials-api
    ports:
      - "${API_PORT:-3001}:3001"
    environment:
      NODE_ENV: production
      PORT: 3001
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ${DB_NAME:-insurance_denials}
      DB_USER: ${DB_USER:-denials_user}
      DB_PASSWORD: ${DB_PASSWORD:-denials_pass}
      JWT_SECRET: ${JWT_SECRET:-change-this-in-production}
      CORS_ORIGIN: http://localhost:5173
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build: ./frontend
    container_name: denials-ui
    ports:
      - "${UI_PORT:-5173}:80"
    depends_on:
      - backend

volumes:
  pgdata:
```

- [ ] **Step 7: Create `docker-compose.override.yml`** (for local dev with hot reload)

```yaml
version: '3.8'

services:
  backend:
    build:
      dockerfile: Dockerfile.dev
    volumes:
      - ./backend/src:/app/src
    environment:
      NODE_ENV: development

  frontend:
    build:
      dockerfile: Dockerfile.dev
    volumes:
      - ./frontend/src:/app/src
```

- [ ] **Step 8: Create `backend/Dockerfile.dev`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]
```

- [ ] **Step 9: Create `frontend/Dockerfile.dev`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

---

### Task 13: README and Final Setup

**Files:**
- Create: `README.md`
- Create: `.env` (copy of `.env.example`)
- Create: `.opencode/todo.md`

- [ ] **Step 1: Create `README.md` with comprehensive documentation**

```markdown
# Insurance Denials Management System

A full-stack React + Express application for processing healthcare EDI 837 (claims) and 835 (remittance) files, analyzing denial patterns, and visualizing claim metrics.

## Architecture

```
├── frontend/        # React (Vite) SPA
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Route pages
│   │   ├── context/     # React contexts (Auth, Theme, Notifications)
│   │   ├── hooks/       # Custom hooks
│   │   ├── services/    # API client modules
│   │   └── styles/      # CSS files
│   ├── Dockerfile
│   └── nginx.conf
├── backend/         # Express REST API
│   ├── src/
│   │   ├── config/      # Environment & DB configuration
│   │   ├── controllers/ # Request handlers
│   │   ├── middleware/   # Auth, error handling
│   │   ├── models/      # Sequelize models
│   │   ├── parsers/     # EDI 837/835 parsers
│   │   ├── routes/      # Express route definitions
│   │   ├── services/    # Business logic
│   │   ├── watcher/     # File system watcher
│   │   └── utils/       # Logger
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
├── data/
│   ├── 837/         # Monitored directory for 837 files
│   └── 835/         # Monitored directory for 835 files
├── docker-compose.yml
└── README.md
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)

### Run with Docker
```bash
# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Access the app
# Frontend: http://localhost:5173
# API:      http://localhost:3001/api/health

# Default admin login: admin / admin123
```

### Local Development
```bash
# Terminal 1: Database
docker-compose up -d postgres

# Terminal 2: Backend
cd backend
cp .env.example .env
npm install
npm run dev

# Terminal 3: Frontend
cd frontend
npm install
npm run dev
```

## API Endpoints

### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | No | Create account |
| POST | /api/auth/login | No | Sign in |
| GET | /api/auth/me | Yes | Current user |
| GET | /api/health | No | Health check |

### Claims
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/claims | Yes | List claims (paginated, filterable) |
| GET | /api/claims/:id | Yes | Claim detail with lines & remittances |
| GET | /api/claims/:id/denials | Yes | Denial reasons for claim |

### Dashboard
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/dashboard/summary | Yes | Aggregate KPI data |
| GET | /api/dashboard/denial-reasons | Yes | Top denial reasons |
| GET | /api/dashboard/trends | Yes | Time-series claim/denial data |
| GET | /api/dashboard/payer-breakdown | Yes | Claims grouped by payer |
| GET | /api/dashboard/aging | Yes | Aging analysis |

### Upload
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/upload/837 | Yes | Upload 837 file |
| POST | /api/upload/835 | Yes | Upload 835 file |
| GET | /api/upload/files | Yes | List uploaded files |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/admin/users | Admin | List all users |
| POST | /api/admin/users | Admin | Create user |

## Dashboard KPIs
- Total claims volume
- Denial rate percentage
- Top denial reasons (CO, PR, OA, PI codes)
- Financial impact (charges vs payments vs adjustments)
- Payer breakdown
- Aging analysis
- Claim trends over time

## Testing
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npx vitest run
```

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| DB_PORT | 5441 | PostgreSQL port |
| DB_NAME | insurance_denials | Database name |
| DB_USER | denials_user | Database user |
| DB_PASSWORD | denials_pass | Database password |
| JWT_SECRET | (random) | JWT signing secret |
| JWT_EXPIRES_IN | 24h | Token expiry |
| API_PORT | 3001 | Backend port |
| UI_PORT | 5173 | Frontend port |
```

---

## Self-Review Checklist

1. **Spec coverage:** Every item from the design doc is mapped to a task:
   - [x] Project scaffolding → Task 1
   - [x] Database schema → Task 2
   - [x] Auth (JWT) → Task 3
   - [x] EDI parsers (837/835) → Task 4
   - [x] File upload + watcher → Task 5
   - [x] Claims + Dashboard API → Task 6
   - [x] Frontend scaffolding + theme → Task 7
   - [x] Frontend auth + login → Task 8
   - [x] Layout components → Task 9
   - [x] Dashboard page + charts → Task 10
   - [x] Claims + Upload + Admin pages → Task 11
   - [x] Docker configuration → Task 12
   - [x] README → Task 13

2. **Placeholder scan:** No TBD, TODOs, or placeholder code. Every step has complete code.

3. **Type consistency:** Function signatures match across tasks (e.g., `parse837(content)` called in Task 5 matches definition in Task 4).

4. **Scope check:** Single focused project — no decomposition needed.
