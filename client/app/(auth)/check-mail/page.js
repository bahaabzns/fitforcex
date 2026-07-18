'use client';

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@heroui/react/button";
import { Suspense } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";

function CheckMailContent() {
    const t = useTranslations('auth');
    usePageTitle(t('checkMailTitle'));
    const searchParams = useSearchParams();
    const email = searchParams.get('email') || t('yourEmail');

    return (
        <div className="auth-wrapper">
            <div className="auth-card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
                <h1 className="auth-title">{t('checkMailTitle')}</h1>
                <p className="text-sm text-muted-foreground mb-6">
                    {t.rich('checkMailBody', { email, b: (chunks) => <strong>{chunks}</strong> })}
                </p>
                <a
                    href={`/reset-password?email=${encodeURIComponent(email)}`}
                    className={buttonVariants({ fullWidth: true })}
                >
                    {t('enterResetCode')}
                </a>
                <p className="auth-link mt-4">
                    <a href="/login">{t('backToLogin')}</a>
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
