import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/',         label: 'Ваучеры',   roles: ['manager', 'admin', 'hotline', 'accountant'] },
    { path: '/clients',  label: 'Клиенты',   roles: ['manager', 'admin'] },
    { path: '/reports',  label: 'Отчёты',    roles: ['manager', 'admin', 'accountant'] },
    { path: '/companies',label: 'Компании',  roles: ['admin'] },
    { path: '/tours',    label: 'Туры',      roles: ['admin'] },
    { path: '/agents',   label: 'Агенты',    roles: ['admin'] },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center space-x-6">
              <Link to="/">
                <h1 className="text-xl font-bold text-blue-600">Tour Tour Phuket</h1>
              </Link>
              <nav className="hidden md:flex space-x-1">
                {navItems
                  .filter(item => !user || item.roles.includes(user.role))
                  .map(item => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        isActive(item.path)
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
              </nav>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">{user?.fullName}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                Выход
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
