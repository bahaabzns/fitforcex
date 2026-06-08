'use client';

import { useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";

export default function VerifyEmailRequiredPage() {
    const router = useRouter();
    const [code, setCode] = useState('');
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendMessage, setResendMessage] = useState('');
    

    const handleVerify = async (e) => {
        e.preventDefault();
        setVerifyLoading(true);
        setError('');
        try {
            await api.post('/api/auth/verify-email', { code });
            const me = await api.get('/api/auth/me');
            const slug = me.data?.currentWorkspace?.slug;
            router.push(slug ? `/${slug}/dashboard` : '/login');
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong. Please try again.');
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleResend = async () => {
        setResendLoading(true);
        setResendMessage('');
        setError('');
        try {
            await api.post('/api/auth/send-verification');
            setResendMessage('A new code has been sent to your email.');
        } catch (err) {
            setError(err.response?.data?.message || 'Could not resend code. Please try again.');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">Verify your email</h1>
                <p className="text-sm text-muted-foreground mb-4">
                    We sent a 6-digit code to your email address. Enter it below to continue.
                </p>
                <form className="auth-form" onSubmit={handleVerify}>
                    <TextField fullWidth isRequired value={code} onChange={setCode}>
                        <Label>Verification Code</Label>
                        <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="123456"
                            maxLength={6}
                        />
                    </TextField>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {resendMessage && <p className="text-sm text-green-600">{resendMessage}</p>}
                    <Button type="submit" color="primary" fullWidth isDisabled={verifyLoading} className="mt-2">
                        {verifyLoading ? 'Verifying…' : 'Verify Email'}
                    </Button>
                </form>
                <p className="auth-link mt-2">
                    Didn&apos;t receive a code?{' '}
                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendLoading}
                        className="underline text-primary disabled:opacity-50"
                    >
                        {resendLoading ? 'Sending…' : 'Resend code'}
                    </button>
                </p>
                <p className="auth-link">
                    <a href="/login">Back to login</a>
                </p>
            </div>
        </div>
    );
}
