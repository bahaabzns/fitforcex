"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import { Skeleton } from "@heroui/react/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";

const STATUS_TITLES = {
    checking: "Checking Payment",
    confirmed: "Payment Confirmed",
    processing: "Payment Processing",
    failed: "Payment Failed",
};

export default function BillingSuccessPage() {
    const { workspaceSlug } = useParams();
    const searchParams      = useSearchParams();
    const paymentId         = searchParams.get("payment");

    // 'checking' | 'confirmed' | 'processing' | 'failed'
    const [status, setStatus] = useState("checking");
    const [detail, setDetail] = useState(null);
    usePageTitle(STATUS_TITLES[status]);

    useEffect(() => {
        if (!paymentId) { setStatus("processing"); return; }

        let attempts = 0;
        const maxAttempts = 10;

        async function poll() {
            try {
                const res = await api.get(`/api/billing/payment-status/${paymentId}`);
                setDetail(res.data);

                if (res.data.status === "paid") {
                    setStatus("confirmed");
                } else if (res.data.status === "failed") {
                    setStatus("failed");
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(poll, 2000);
                } else {
                    setStatus("processing");
                }
            } catch {
                setStatus("processing");
            }
        }

        poll();
    }, [paymentId]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-8">
            <div className="max-w-sm w-full flex flex-col items-center gap-6 text-center">

                {status === "checking" && (
                    <>
                        <Skeleton className="w-16 h-16 rounded-full" />
                        <div className="flex flex-col gap-2 w-full">
                            <Skeleton className="h-7 w-48 rounded-lg mx-auto" />
                            <Skeleton className="h-4 w-64 rounded mx-auto" />
                        </div>
                    </>
                )}

                {status === "confirmed" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Payment Confirmed!</h1>
                            {detail?.planDisplay && (
                                <p className="text-muted-foreground text-sm mt-1">
                                    Your <strong>{detail.planDisplay}</strong> subscription is now active.
                                </p>
                            )}
                        </div>
                        <Link
                            href={`/${workspaceSlug}/dashboard`}
                            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors text-center"
                        >
                            Go to Dashboard
                        </Link>
                    </>
                )}

                {status === "processing" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-yellow-500/15 flex items-center justify-center">
                            <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Payment Processing</h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                Your payment is being confirmed. Your subscription will activate automatically — this usually takes under a minute.
                            </p>
                        </div>
                        <Link
                            href={`/${workspaceSlug}/settings`}
                            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors text-center"
                        >
                            Back to Settings
                        </Link>
                    </>
                )}

                {status === "failed" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center">
                            <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Payment Failed</h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                Something went wrong. No charge was made. Please try again.
                            </p>
                        </div>
                        <Link
                            href={`/${workspaceSlug}/settings`}
                            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors text-center"
                        >
                            Try Again
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
