'use client';

import { useSearchParams } from "next/navigation";
import { Button } from "@heroui/react/button";
import { Suspense } from "react";

function CheckMailContent() {
    const searchParams = useSearchParams();
    const email = searchParams.get('email') || 'your email';

    return (
        <div className="auth-wrapper">
            <div className="auth-card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
                <h1 className="auth-title">Check your email</h1>
                <p className="text-sm text-muted-foreground mb-6">
                    We sent a 6-digit code to <strong>{email}</strong>.
                    Enter it on the reset password page.
                </p>
                <Button
                    as="a"
                    href={`/reset-password?email=${encodeURIComponent(email)}`}
                    color="primary"
                    fullWidth
                >
                    Enter Reset Code
                </Button>
                <p className="auth-link mt-4">
                    <a href="/login">Back to login</a>
                </p>
            </div>
        </div>
    );
}

export default function CheckMailPage() {
    return (
        <Suspense>
            <CheckMailContent />
        </Suspense>
    );
}
