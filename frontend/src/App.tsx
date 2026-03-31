import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import VouchersPage from './pages/VouchersPage';
import VoucherFormPage from './pages/VoucherFormPage';
import VoucherDetailPage from './pages/VoucherDetailPage';
import ClientsPage from './pages/ClientsPage';
import ReportsPage from './pages/ReportsPage';
import CompaniesPage from './pages/CompaniesPage';
import ToursPage from './pages/ToursPage';
import AgentsPage from './pages/AgentsPage';
import ManagersPage from './pages/ManagersPage';
import HotlinePage from './pages/HotlinePage';

const getDefaultPage = (user: any) => {
  const roles: string[] = user?.roles || [user?.role];
  if (roles.includes('hotline') && !roles.includes('admin') && !roles.includes('manager') && !roles.includes('accountant')) return '/hotline';
  if (roles.includes('editor') && !roles.includes('admin') && !roles.includes('manager') && !roles.includes('accountant')) return '/companies';
  return '/';
};

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, loading, hasRole } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !hasRole(...allowedRoles)) return <Navigate to={getDefaultPage(user)} />;
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <ThemeProvider>
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute allowedRoles={['admin','manager','accountant']}><VouchersPage /></ProtectedRoute>} />
            <Route path="/vouchers/new" element={<ProtectedRoute allowedRoles={['admin','manager']}><VoucherFormPage /></ProtectedRoute>} />
            <Route path="/vouchers/:id" element={<ProtectedRoute allowedRoles={['admin','manager','accountant']}><VoucherDetailPage /></ProtectedRoute>} />
            <Route path="/vouchers/:id/edit" element={<ProtectedRoute allowedRoles={['admin','manager']}><VoucherFormPage /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute allowedRoles={['admin']}><ClientsPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin','manager','accountant']}><ReportsPage /></ProtectedRoute>} />
            <Route path="/companies" element={<ProtectedRoute allowedRoles={['admin','editor']}><CompaniesPage /></ProtectedRoute>} />
            <Route path="/tours" element={<ProtectedRoute allowedRoles={['admin','editor']}><ToursPage /></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute allowedRoles={['admin','manager']}><AgentsPage /></ProtectedRoute>} />
            <Route path="/managers" element={<ProtectedRoute allowedRoles={['admin','accountant']}><ManagersPage /></ProtectedRoute>} />
            <Route path="/hotline" element={<ProtectedRoute allowedRoles={['admin','manager','hotline']}><HotlinePage /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
