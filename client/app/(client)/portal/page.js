"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { getCoachSlug } from "@/lib/coachSlug";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";
import { Alert } from "@heroui/react/alert";

// The slug comes from the subdomain, which only exists in the browser. useSyncExternalStore
// reads it safely: null during SSR, the real slug after hydration — no hydration mismatch.
const subscribeNoop = () => () => {};

export default function PortalLoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
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
            await api.post("/api/client-portal/login", { email, password, coach_slug: coachSlug });
            router.push("/portal/home");
        } catch (err) {
            setError(err.response?.data?.message || "Login failed");
        } finally {
            setLoading(false);
        }
    }

    if (checkingSession) return null;

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">Client Portal</h1>
                {coachSlug && (
                    <p className="text-sm text-muted-foreground -mt-2 mb-2">Portal: {coachSlug}</p>
                )}
                <form className="auth-form" onSubmit={handleSubmit}>
                    <TextField value={email} onChange={setEmail} isRequired>
                        <Label>Email</Label>
                        <Input type="email" autoComplete="email" />
                    </TextField>
                    <TextField value={password} onChange={setPassword} isRequired>
                        <Label>Password</Label>
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
                        {loading ? "Signing in…" : "Sign in"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
