'use client';

import { useState, Suspense } from "react";
import api from "@/lib/axios";
import { useRouter, useSearchParams } from "next/navigation";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [formData, setFormData] = useState({
        email: searchParams.get('email') || '',
        code: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const set = (field) => (val) => setFormData(prev => ({ ...prev, [field]: val }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.newPassword !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await api.post('/api/auth/reset-password', {
                email: formData.email,
                code: formData.code,
                newPassword: formData.newPassword,
            });
            router.push('/login?reset=success');
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">Reset Password</h1>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <TextField fullWidth isRequired value={formData.email} onChange={set('email')}>
                        <Label>Email</Label>
                        <Input type="email" placeholder="you@example.com" />
                    </TextField>
                    <TextField fullWidth isRequired value={formData.code} onChange={set('code')}>
                        <Label>6-digit Reset Code</Label>
                        <Input type="text" inputMode="numeric" placeholder="123456" maxLength={6} />
                    </TextField>
                    <TextField fullWidth isRequired value={formData.newPassword} onChange={set('newPassword')}>
                        <Label>New Password</Label>
                        <Input type="password" placeholder="At least 8 characters" />
                    </TextField>
                    <TextField fullWidth isRequired value={formData.confirmPassword} onChange={set('confirmPassword')}>
                        <Label>Confirm New Password</Label>
                        <Input type="password" placeholder="Repeat new password" />
                    </TextField>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" color="primary" fullWidth isDisabled={loading} className="mt-2">
                        {loading ? 'Resetting…' : 'Reset Password'}
                    </Button>
                    <p className="auth-link">
                        <a href="/forgot-password">Resend code</a>
                        {' · '}
                        <a href="/login">Back to login</a>
                    </p>
                </form>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense>
            <ResetPasswordContent />
        </Suspense>
    );
}
