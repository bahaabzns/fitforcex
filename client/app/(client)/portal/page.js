"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { getCoachSlug } from "@/lib/coachSlug";
import { normalizeEmail } from "@/lib/normalizeEmail";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";
import { Alert } from "@heroui/react/alert";
import { Eye, EyeOff } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

// The slug comes from the subdomain, which only exists in the browser. useSyncExternalStore
// reads it safely: null during SSR, the real slug after hydration — no hydration mismatch.
const subscribeNoop = () => () => {};

export default function PortalLoginPage() {
    const t = useTranslations('auth');
    const tCommon = useTranslations('common');
    usePageTitle(t('clientPortal'));
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const coachSlug = useSyncExternalStore(subscribeNoop, getCoachSlug, () => null);
    const router = useRouter();

    // Remember the slug for any later flow that needs it (external system write).
    useEffect(() => {
        if (coachSlug) localStorage.setItem("portal_slug", coachSlug);
    }, [coachSlug]);

    useEffect(() => {
        // Already authenticated — skip login
        api.get("/api/client-portal/me")
            .then(() => router.replace("/portal/home"))
            .catch(() => setCheckingSession(false));
    }, [router]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await api.post("/api/client-portal/login", { email: normalizeEmail(email), password, coach_slug: coachSlug });
            router.push("/portal/home");
        } catch (err) {
            setError(err.response?.data?.message || t("loginFailed"));
        } finally {
            setLoading(false);
        }
    }

    if (checkingSession) return null;

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">{t('clientPortal')}</h1>
                {coachSlug && (
                    <p className="text-sm text-muted-foreground -mt-2 mb-2">{t('portalSlugLabel', { slug: coachSlug })}</p>
                )}
                <form className="auth-form" onSubmit={handleSubmit}>
                    <TextField value={email} onChange={setEmail} isRequired variant="secondary">
                        <Label>{t('email')}</Label>
                        <Input type="email" autoComplete="email" />
                    </TextField>
                    <TextField value={password} onChange={setPassword} isRequired variant="secondary">
                        <Label>{t('password')}</Label>
                        <div className="relative">
                            <Input
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                className="w-full ltr:pr-10 rtl:pl-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 flex items-center justify-center border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground"
                                aria-label={showPassword ? tCommon('hide') : tCommon('show')}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
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
