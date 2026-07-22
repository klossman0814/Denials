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
