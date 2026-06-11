'use client';

import { useState } from "react";
import api from "@/lib/axios";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
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
            setError(err.response?.data?.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">Forgot Password</h1>
                <p className="text-sm text-muted-foreground mb-4">
                    Enter your email and we&apos;ll send you a 6-digit reset code.
                </p>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        isRequired
                        value={email}
                        onChange={setEmail}
                    >
                        <Label>Email</Label>
                        <Input type="email" placeholder="you@example.com" />
                    </TextField>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" color="primary" fullWidth isDisabled={loading} className="mt-2">
                        {loading ? 'Sending…' : 'Send Reset Code'}
                    </Button>
                    <p className="auth-link">
                        <a href="/login">Back to login</a>
                    </p>
                </form>
            </div>
        </div>
    );
}
