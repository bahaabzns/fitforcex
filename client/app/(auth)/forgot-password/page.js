'use client';

import { useState } from "react";
import api from "@/lib/axios";
import { useTranslations } from "next-intl";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
    const t = useTranslations('auth');
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.post('/api/auth/forgot-password', { email });
            router.push(`/check-mail?email=${encodeURIComponent(email)}`);
        } catch (err) {
            setError(err.response?.data?.message || t('genericError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">{t('forgotPasswordTitle')}</h1>
                <p className="text-sm text-muted-foreground mb-4">
                    {t('forgotPasswordSubtitle')}
                </p>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        isRequired
                        variant="secondary"
                        value={email}
                        onChange={setEmail}
                    >
                        <Label>{t('email')}</Label>
                        <Input type="email" placeholder="you@example.com" />
                    </TextField>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" color="primary" fullWidth isDisabled={loading} className="mt-2">
                        {loading ? t('sendingCode') : t('sendResetCode')}
                    </Button>
                    <p className="auth-link">
                        <a href="/login">{t('backToLogin')}</a>
                    </p>
                </form>
            </div>
        </div>
    );
}
