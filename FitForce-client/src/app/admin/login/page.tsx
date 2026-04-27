'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      // Use the AdminAuthContext login method
      await login(email, password);
      
      // If login succeeds, redirect to admin dashboard
      router.replace('/admin');
      
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 24,
      backgroundColor: '#f9fafb'
    }}>
      <div style={{ 
        width: 420, 
        maxWidth: '92vw',
        backgroundColor: 'white',
        padding: 32,
        borderRadius: 12,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6, color: '#111827' }}>
            FitForce Admin
          </div>
          <div style={{ color: '#6b7280', fontSize: 14 }}>
            Management Panel Login
          </div>
        </div>
        
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#111827' }}>
          Sign In
        </h2>
        <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
          Enter your admin credentials to access the management panel.
        </p>
        
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@fitforce.io"
              required
              style={{ 
                padding: '12px 16px', 
                border: '1px solid #d1d5db', 
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>
          
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{ 
                padding: '12px 16px', 
                border: '1px solid #d1d5db', 
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>
          
          {error && (
            <div style={{ 
              color: '#dc2626', 
              fontSize: 14, 
              padding: '8px 12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6
            }}>
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: loading ? '#9ca3af' : '#111827',
              color: 'white',
              border: 0,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div style={{ 
          marginTop: 24, 
          padding: 16, 
          backgroundColor: '#f3f4f6', 
          borderRadius: 8,
          fontSize: 12,
          color: '#6b7280'
        }}>
          <strong>Note:</strong> This is a session-based login. You will need to sign in again after closing your browser.
        </div>
      </div>
    </div>
  );
}


