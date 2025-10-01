'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { APP_CONFIG } from '@/lib/config';
import api from '@/utils/axios';

export default function AdminLoginPage() {
  const router = useRouter();
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
      await api.post('/api/auth/login', { email, password });
      router.replace('/admin');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: 420, maxWidth: '92vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Welcome to FitForce</div>
          <div style={{ color: '#6b7280' }}>
            Build your fitness business with client management, workouts, nutrition, and more.
          </div>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Management Login</h2>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>
          Sign in to manage workspaces, subscriptions, and packages.
        </p>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12 }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`admin@${APP_CONFIG.frontendDomain}`}
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12 }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
            />
          </label>
          {error && (
            <div style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: '#111827',
              color: 'white',
              border: 0,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}


