import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import VouchersPage from './pages/VouchersPage';
import VoucherFormPage from './pages/VoucherFormPage';
import VoucherDetailPage from './pages/VoucherDetailPage';  // ← ДОБАВЬТЕ
import ClientsPage from './pages/ClientsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <VouchersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vouchers/new"
            element={
              <ProtectedRoute>
                <VoucherFormPage />
              </ProtectedRoute>
            }
          />
          {/* ← ДОБАВЬТЕ ЭТИ 2 РОУТА */}
          <Route
            path="/vouchers/:id"
            element={
              <ProtectedRoute>
                <VoucherDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vouchers/:id/edit"
            element={
              <ProtectedRoute>
                <VoucherFormPage />
              </ProtectedRoute>
            }
          />
          {/* ← ДО СЮДА */}
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <ClientsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;