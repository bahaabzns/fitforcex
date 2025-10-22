'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/axios';

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
}

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  adminToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check for existing admin token on mount
  useEffect(() => {
    const token = sessionStorage.getItem('adminToken');
    if (token) {
      setAdminToken(token);
      // Set default Authorization header for admin API calls
      (api as any).defaults = (api as any).defaults || {};
      (api as any).defaults.headers = (api as any).defaults.headers || {};
      (api as any).defaults.headers.common = (api as any).defaults.headers.common || {};
      (api as any).defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Verify token is still valid
      verifyToken(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      // Test the token by trying to access an admin endpoint
      const response = await api.get('/api/admin/workspaces', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // If we get here, the token is valid
      // We can extract user info from the token or make another call
      setAdminToken(token);
      
      // Try to get user info from the token payload (basic approach)
      // For now, we'll set a basic admin user object
      setAdminUser({
        id: 'admin',
        fullName: 'FitForce Admin',
        email: 'admin@fitforce.io'
      });
      
    } catch (error) {
      // Token is invalid, clear it
      sessionStorage.removeItem('adminToken');
      setAdminToken(null);
      setAdminUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/api/auth/admin-login', { email, password });
      
      if (response.data.token) {
        const token = response.data.token;
        sessionStorage.setItem('adminToken', token);
        setAdminToken(token);
        setAdminUser(response.data.user);
        // Set default Authorization header so subsequent admin requests succeed
        (api as any).defaults = (api as any).defaults || {};
        (api as any).defaults.headers = (api as any).defaults.headers || {};
        (api as any).defaults.headers.common = (api as any).defaults.headers.common || {};
        (api as any).defaults.headers.common['Authorization'] = `Bearer ${token}`;
        // Navigate to admin home after successful login
        router.replace('/admin');
      } else {
        throw new Error('No token received from server');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Login failed';
      throw new Error(msg);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('adminToken');
    setAdminToken(null);
    setAdminUser(null);
    router.push('/admin/login');
  };

  const isAuthenticated = !!adminToken && !!adminUser;

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        adminToken,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
