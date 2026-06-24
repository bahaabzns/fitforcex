"use client";

import { useTranslations } from "next-intl";
import { Lock, PauseCircle } from "lucide-react";
import { Button } from "@heroui/react/button";

/**
 * Full-screen subscription status card shown when a client's portal access is
 * restricted. `variant` is "expired" or "frozen". `onContact` / renew handler
 * is optional; falls back to the messages page for "Contact Coach".
 */
export default function ClientPortalStatusCard({ variant = "expired", compact = false }) {
    const t = useTranslations("portal.status");
    const isFrozen = variant === "frozen";

    const Icon = isFrozen ? PauseCircle : Lock;
    const title = isFrozen ? t("frozenTitle") : t("expiredTitle");
    const body = isFrozen ? t("frozenBody") : t("expiredBody");
    const cta = isFrozen ? t("frozenCta") : t("expiredCta");

    const card = (
        <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 flex flex-col items-center text-center gap-4">
            <div className={`rounded-full p-4 ${isFrozen ? "bg-amber-500/10 text-amber-600" : "bg-destructive/10 text-destructive"}`}>
                <Icon size={32} />
            </div>
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            <Button
                variant="primary"
                className="mt-2 w-full"
                onClick={() => { if (isFrozen) window.location.href = "/portal/messages"; }}
            >
                {cta}
            </Button>
        </div>
    );

    if (compact) return card;

    return (
        <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-background px-4">
            {card}
        </div>
    );
}
