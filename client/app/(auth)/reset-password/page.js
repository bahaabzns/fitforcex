'use client';

import { useState, Suspense } from "react";
import api from "@/lib/axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";

function ResetPasswordContent() {
    const t = useTranslations('auth');
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
            setError(t('passwordsDoNotMatch'));
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
            setError(err.response?.data?.message || t('genericError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">{t('resetPasswordTitle')}</h1>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <TextField fullWidth isRequired variant="secondary" value={formData.email} onChange={set('email')}>
                        <Label>{t('email')}</Label>
                        <Input type="email" placeholder="you@example.com" />
                    </TextField>
                    <TextField fullWidth isRequired variant="secondary" value={formData.code} onChange={set('code')}>
                        <Label>{t('resetCodeLabel')}</Label>
                        <Input type="text" inputMode="numeric" placeholder="123456" maxLength={6} />
                    </TextField>
                    <TextField fullWidth isRequired variant="secondary" value={formData.newPassword} onChange={set('newPassword')}>
                        <Label>{t('newPassword')}</Label>
                        <Input type="password" placeholder={t('newPasswordPlaceholder')} />
                    </TextField>
                    <TextField fullWidth isRequired variant="secondary" value={formData.confirmPassword} onChange={set('confirmPassword')}>
                        <Label>{t('confirmNewPassword')}</Label>
                        <Input type="password" placeholder={t('confirmPasswordPlaceholder')} />
                    </TextField>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" color="primary" fullWidth isDisabled={loading} className="mt-2">
                        {loading ? t('resetting') : t('resetPasswordTitle')}
                    </Button>
                    <p className="auth-link">
                        <a href="/forgot-password">{t('resendCode')}</a>
                        {' · '}
                        <a href="/login">{t('backToLogin')}</a>
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
