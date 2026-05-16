'use client';

import { useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.post('/api/auth/login', formData);
            const me = await api.get('/api/auth/me');
            const slug = me.data?.currentWorkspace?.slug;
            router.push(slug ? `/${slug}/dashboard` : '/login');
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid email or password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">Coach Login</h1>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        isRequired
                        value={formData.email}
                        onChange={(val) => setFormData(prev => ({ ...prev, email: val }))}
                    >
                        <Label>Email</Label>
                        <Input type="email" placeholder="you@example.com" />
                    </TextField>
                    <TextField
                        fullWidth
                        isRequired
                        value={formData.password}
                        onChange={(val) => setFormData(prev => ({ ...prev, password: val }))}
                    >
                        <Label>Password</Label>
                        <Input type="password" placeholder="••••••••" />
                    </TextField>
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                    <Button type="submit" color="primary" fullWidth isDisabled={loading} className="mt-2">
                        {loading ? 'Logging in…' : 'Login'}
                    </Button>
                    <p className="auth-link">
                        Don&apos;t have an account?{" "}
                        <a href="/register">Register here</a>
                    </p>
                </form>
            </div>
        </div>
    );
}
