"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles, X } from "lucide-react";
import { Button } from "@heroui/react/button";
import api from "@/lib/axios";

// Only in-app paths (optionally containing the {slug} placeholder) and https URLs are ever
// followed; the server enforces the same rule on write, this is a second line of defence.
const INTERNAL_PATH = /^\/[A-Za-z0-9_{}/-]*$/;

function resolveHref(href, workspaceSlug) {
    if (!href) return null;
    if (/^https:\/\//.test(href)) return { external: true, url: href };
    if (INTERNAL_PATH.test(href)) return { external: false, url: href.replace("{slug}", workspaceSlug) };
    return null;
}

/**
 * The single "what's new" card at the top of the dashboard: image (or an illustration
 * fallback), a one-line title, a one-line benefit and one CTA. Shows at most one announcement;
 * dismissing it (or clicking its CTA) reveals the next one on the following visit. Dismissal is
 * stored per coach server-side, so it follows them across devices.
 *
 * Renders nothing while loading, on failure, or when there is nothing to show — a failed
 * announcements request must never affect the dashboard.
 */
export default function AnnouncementCard() {
    const t = useTranslations("announcements");
    const locale = useLocale();
    const router = useRouter();
    const { workspaceSlug } = useParams();
    const [announcement, setAnnouncement] = useState(null);

    useEffect(() => {
        let active = true;
        api.get("/api/announcements/active")
            .then((res) => { if (active) setAnnouncement(res.data?.announcement ?? null); })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    const record = useCallback((id, action) => {
        // Fire-and-forget: the card is hidden optimistically and a lost request only means it
        // reappears next visit.
        api.post(`/api/announcements/${id}/dismiss`, { action }).catch(() => {});
    }, []);

    if (!announcement) return null;

    const isArabic = locale === "ar";
    const title = (isArabic && announcement.titleAr) || announcement.title;
    const body = (isArabic && announcement.bodyAr) || announcement.body;
    const ctaLabel = (isArabic && announcement.ctaLabelAr) || announcement.ctaLabel;
    const target = resolveHref(announcement.ctaHref, workspaceSlug);

    function handleDismiss() {
        record(announcement.id, "dismissed");
        setAnnouncement(null);
    }

    function handleCta() {
        record(announcement.id, "clicked");
        setAnnouncement(null);
        if (!target) return;
        if (target.external) window.open(target.url, "_blank", "noopener,noreferrer");
        else router.push(target.url);
    }

    return (
        <section
            aria-label={t("label")}
            className="relative flex overflow-hidden rounded-2xl border border-border bg-card"
        >
            <div className="hidden sm:block relative w-56 shrink-0 bg-primary/10">
                {announcement.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded, resized server-side
                    <img src={announcement.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-primary">
                        <Sparkles size={40} strokeWidth={1.5} />
                    </div>
                )}
            </div>

            <div className="flex min-w-0 grow flex-col justify-center gap-1 p-5 pe-12">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">{t("badge")}</span>
                <h2 className="text-base font-semibold text-foreground truncate">{title}</h2>
                <p className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-1">{body}</p>
                {ctaLabel && target && (
                    <div className="pt-2">
                        <Button size="sm" variant="primary" onClick={handleCta}>{ctaLabel}</Button>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={handleDismiss}
                aria-label={t("dismiss")}
                className="absolute top-2 inset-e-2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-default hover:text-foreground border-0 bg-transparent"
            >
                <X size={16} />
            </button>
        </section>
    );
}
