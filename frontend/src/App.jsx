import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Claims from './pages/Claims';
import ClaimDetail from './pages/ClaimDetail';
import Upload from './pages/Upload';
import FileDetail from './pages/FileDetail';
import Mismatches from './pages/Mismatches';
import MatchedClaims from './pages/MatchedClaims';
import ExecutiveSummary from './pages/ExecutiveSummary';
import DenialExtract from './pages/DenialExtract';
import Admin from './pages/Admin';
import Denials from './pages/Denials';
import Remittances from './pages/Remittances';
import RemittanceDetail from './pages/RemittanceDetail';
import AppLayout from './components/Layout/AppLayout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}><div className="spinner" /></div>;
  return user ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}><div className="spinner" /></div>;
  return user?.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}><div className="spinner" /></div>;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/claims" element={<Claims />} />
              <Route path="/claims/:id" element={<ClaimDetail />} />
              <Route path="/denials" element={<Denials />} />
              <Route path="/remittances" element={<Remittances />} />
              <Route path="/remittances/:id" element={<RemittanceDetail />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/files/:id" element={<FileDetail />} />
              <Route path="/mismatches" element={<Mismatches />} />
              <Route path="/matched-claims" element={<MatchedClaims />} />
              <Route path="/executive-summary" element={<ExecutiveSummary />} />
              <Route path="/denial-extract" element={<DenialExtract />} />
              <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
