'use client';

import { useState } from 'react';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import { TextField } from '@heroui/react/textfield';
import { Label } from '@heroui/react/label';
import { Input } from '@heroui/react/input';
import { Button } from '@heroui/react/button';

export default function AdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/api/admin/login', { email, password });
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
                    <TextField value={email} onChange={setEmail} isRequired>
                        <Label>Email</Label>
                        <Input type="email" />
                    </TextField>
                    <TextField value={password} onChange={setPassword} isRequired>
                        <Label>Password</Label>
                        <Input type="password" />
                    </TextField>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <Button type="submit" variant="primary" fullWidth isDisabled={loading}>
                        {loading ? 'Signing in…' : 'Sign in'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
