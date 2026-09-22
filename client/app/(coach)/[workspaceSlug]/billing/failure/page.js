"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function BillingFailurePage() {
    const { workspaceSlug } = useParams();
    usePageTitle("Payment Cancelled");

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-8">
            <div className="max-w-sm w-full flex flex-col items-center gap-6 text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center">
                    <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Payment Cancelled</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Your payment was not completed. No charge has been made.
                        You can try again from the Billing tab in your settings.
                    </p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                    <Link
                        href={`/${workspaceSlug}/settings`}
                        className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors text-center"
                    >
                        Back to Settings
                    </Link>
                    <Link
                        href={`/${workspaceSlug}/dashboard`}
                        className="w-full py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors text-center"
                    >
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
