"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { useTranslations } from "next-intl";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";
import { Alert } from "@heroui/react/alert";

export default function ClientLoginPage() {
    const t = useTranslations('auth');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const coachSlug = searchParams.get("coach_slug");

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        if (!coachSlug) {
            setError(t('invalidLoginLink'));
            return;
        }
        setLoading(true);
        try {
            await api.post("/api/client-portal/login", { email, password, coach_slug: coachSlug });
            router.push("/portal/dashboard");
        } catch (err) {
            setError(err.response?.data?.message || t('loginFailed'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">{t('clientPortal')}</h1>
                <p className="text-sm text-muted-foreground -mt-2 mb-2">{t('clientPortalSubtitle')}</p>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <TextField value={email} onChange={setEmail} isRequired>
                        <Label>{t('email')}</Label>
                        <Input type="email" autoComplete="email" />
                    </TextField>
                    <TextField value={password} onChange={setPassword} isRequired>
                        <Label>{t('password')}</Label>
                        <Input type="password" autoComplete="current-password" />
                    </TextField>
                    {error && (
                        <Alert>
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Description>{error}</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    )}
                    <Button type="submit" variant="primary" fullWidth isDisabled={loading}>
                        {loading ? t('signingIn') : t('signIn')}
                    </Button>
                </form>
            </div>
        </div>
    );
}
