import React, { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../api';

interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
  roles: string[];
  commissionPercentage?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  hasRole: (...roles: string[]) => boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      const u = JSON.parse(savedUser);
      if (!u.roles || u.roles.length === 0) u.roles = [u.role];
      setUser(u);
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await api.login(username, password);
      const { token, user: u } = response.data;
      // Normalise roles
      if (!u.roles || u.roles.length === 0) u.roles = [u.role];

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(u));
      setUser(u);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    const userRoles = user.roles || [user.role];
    return roles.some(r => userRoles.includes(r));
  };

  return (
    <AuthContext.Provider value={{ user, loading, hasRole, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
