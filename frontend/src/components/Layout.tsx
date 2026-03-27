import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const { t, lang, setLang } = useLanguage();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/',          label: t.navVouchers,  roles: ['manager', 'admin', 'hotline', 'accountant', 'editor'] },
    { path: '/clients',   label: t.navClients,   roles: ['manager', 'admin', 'editor'] },
    { path: '/reports',   label: t.navReports,   roles: ['manager', 'admin', 'accountant'] },
    { path: '/hotline',   label: 'Хотлайн',      roles: ['admin', 'manager', 'hotline'] },
    { path: '/companies', label: t.navCompanies, roles: ['admin', 'editor'] },
    { path: '/tours',     label: t.navTours,     roles: ['admin', 'editor'] },
    { path: '/agents',    label: t.navAgents,    roles: ['admin', 'manager', 'editor'] },
    { path: '/managers',  label: t.navManagers,  roles: ['admin'] },
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
                  .filter(item => !user || item.roles.some(r => hasRole(r)))
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
              {/* Language switcher */}
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs font-semibold">
                <button
                  onClick={() => setLang('ru')}
                  className={`px-2.5 py-1.5 transition ${lang === 'ru' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  RU
                </button>
                <button
                  onClick={() => setLang('en')}
                  className={`px-2.5 py-1.5 transition ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  EN
                </button>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">{user?.fullName}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.roles?.join(', ') || user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                {t.logout}
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
