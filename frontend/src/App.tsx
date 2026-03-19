import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><VouchersPage /></ProtectedRoute>} />
            <Route path="/vouchers/new" element={<ProtectedRoute><VoucherFormPage /></ProtectedRoute>} />
            <Route path="/vouchers/:id" element={<ProtectedRoute><VoucherDetailPage /></ProtectedRoute>} />
            <Route path="/vouchers/:id/edit" element={<ProtectedRoute><VoucherFormPage /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
            <Route path="/companies" element={<ProtectedRoute><CompaniesPage /></ProtectedRoute>} />
            <Route path="/tours" element={<ProtectedRoute><ToursPage /></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><AgentsPage /></ProtectedRoute>} />
            <Route path="/managers" element={<ProtectedRoute><ManagersPage /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
