'use client';

import { useState } from 'react';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function AdminLoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/api/admin/login', formData);
            router.push('/admin');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">Admin Login</h1>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="auth-field">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="auth-field">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Signing in…' : 'Sign in'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
