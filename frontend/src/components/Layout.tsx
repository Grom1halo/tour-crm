import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const { t, lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/',          label: t.navVouchers,  roles: ['manager', 'admin', 'accountant'] },
    { path: '/clients',   label: t.navClients,   roles: ['admin'] },
    { path: '/reports',   label: t.navReports,   roles: ['manager', 'admin', 'accountant'] },
    { path: '/hotline',   label: 'Хотлайн',      roles: ['admin', 'manager', 'hotline'] },
    { path: '/companies', label: t.navCompanies, roles: ['admin', 'editor'] },
    { path: '/tours',     label: t.navTours,     roles: ['admin', 'editor'] },
    { path: '/agents',    label: t.navAgents,    roles: ['admin', 'manager'] },
    { path: '/managers',  label: t.navManagers,  roles: ['admin', 'accountant'] },
  ];

  const visibleItems = navItems.filter(item => !user || item.roles.some(r => hasRole(r)));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center space-x-6">
              <Link to="/" onClick={() => setMenuOpen(false)}>
                <h1 className="text-xl font-bold text-blue-600">Tour Tour Phuket</h1>
              </Link>
              {/* Desktop nav */}
              <nav className="hidden md:flex space-x-1">
                {visibleItems.map(item => (
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
              {/* Dark mode toggle */}
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
                title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1zm0 15a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1zm9-9a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2h1zM4 12a1 1 0 1 1 0-2H3a1 1 0 1 1 0 2h1zm13.66-5.66a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0zM7.05 16.95a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0zm9.9 0a1 1 0 0 1 1.41 0l.71.71a1 1 0 1 1-1.41 1.41l-.71-.71a1 1 0 0 1 0-1.41zM5.64 5.64a1 1 0 0 1 1.41 0l.71.71A1 1 0 1 1 6.35 7.76l-.71-.71a1 1 0 0 1 0-1.41zM12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>
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
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-700">{user?.fullName}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.roles?.join(', ') || user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="hidden sm:block px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                {t.logout}
              </button>
              {/* Hamburger button — mobile only */}
              <button
                onClick={() => setMenuOpen(prev => !prev)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
                aria-label="Меню"
              >
                {menuOpen ? (
                  /* X icon */
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  /* Hamburger icon */
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <nav className="px-4 py-3 flex flex-col space-y-1">
              {visibleItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive(item.path)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-gray-100 pt-3 mt-2">
                <p className="px-3 text-sm font-medium text-gray-700">{user?.fullName}</p>
                <p className="px-3 text-xs text-gray-500 capitalize mb-2">{user?.roles?.join(', ') || user?.role}</p>
                <button
                  onClick={() => { setMenuOpen(false); logout(); }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  {t.logout}
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
