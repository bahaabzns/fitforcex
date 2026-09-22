"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock, LogOut, PauseCircle } from "lucide-react";
import { Button } from "@heroui/react/button";
import api from "@/lib/axios";

/**
 * Full-screen subscription status card shown when a client's portal access is
 * restricted. `variant` is "expired" or "frozen". `renewalLink` is the coach's
 * configured URL (Settings → Workspace → Client Portal) that the "expired" CTA
 * opens; the button stays disabled if the coach hasn't set one yet.
 */
export default function ClientPortalStatusCard({ variant = "expired", renewalLink = null, compact = false }) {
    const t = useTranslations("portal.status");
    const router = useRouter();
    const isFrozen = variant === "frozen";

    const Icon = isFrozen ? PauseCircle : Lock;
    const title = isFrozen ? t("frozenTitle") : t("expiredTitle");
    const body = isFrozen ? t("frozenBody") : t("expiredBody");
    const cta = isFrozen ? t("frozenCta") : t("expiredCta");

    async function handleLogout() {
        await api.post("/api/client-portal/logout").catch(() => {});
        router.push("/portal");
    }

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
                isDisabled={!isFrozen && !renewalLink}
                onClick={() => {
                    if (isFrozen) window.location.href = "/portal/messages";
                    else if (renewalLink) window.open(renewalLink, "_blank", "noopener,noreferrer");
                }}
            >
                {cta}
            </Button>
            <Button variant="ghost" className="w-full" onClick={handleLogout}>
                <LogOut size={16} className="shrink-0" />
                {t("logout")}
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
