'use client';

import { useState, useEffect, Suspense } from "react";
import api from "@/lib/axios";
import { useRouter, useSearchParams } from "next/navigation";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(searchParams.get('reset') === 'success' ? 'Password reset successfully. You can now log in.' : '');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        api.get('/api/auth/me')
            .then(res => {
                if (res.data?.emailVerified === false) {
                    router.push('/verify-email-required');
                    return;
                }
                const slug = res.data?.currentWorkspace?.slug;
                if (slug) {
                    router.push(`/${slug}/dashboard`);
                    return;
                }
                setChecking(false);
            })
            .catch(() => setChecking(false));
    }, [router]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.post('/api/auth/login', formData);
            const me = await api.get('/api/auth/me');
            if (me.data?.emailVerified === false) {
                router.push('/verify-email-required');
                return;
            }
            const slug = me.data?.currentWorkspace?.slug;
            router.push(slug ? `/${slug}/dashboard` : '/login');
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid email or password.');
        } finally {
            setLoading(false);
        }
    };

    if (checking) {
        return (
            <div className="auth-wrapper">
                <div className="auth-card flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-center text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

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
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {success && <p className="text-sm text-green-600">{success}</p>}
                    <Button type="submit" color="primary" fullWidth isDisabled={loading} className="mt-2">
                        {loading ? 'Logging in…' : 'Login'}
                    </Button>
                    <p className="auth-link">
                        <a href="/forgot-password">Forgot password?</a>
                    </p>
                    <p className="auth-link">
                        Don&apos;t have an account?{" "}
                        <a href="/register">Register here</a>
                    </p>
                </form>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginContent />
        </Suspense>
    );
}
