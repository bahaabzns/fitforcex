"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles, X } from "lucide-react";
import { Button } from "@heroui/react/button";
import api from "@/lib/axios";

// Only in-app paths (optionally containing the {slug} placeholder) and https URLs are ever
// followed; the server enforces the same rule on write, this is a second line of defence.
const INTERNAL_PATH = /^\/[A-Za-z0-9_{}/-]*$/;

// Space between carousel cards on a phone (Tailwind gap-3), used to work out which card is in view.
const CAROUSEL_GAP_PX = 12;

// Columns by how many are showing, so 1 / 2 / 3 announcements always fill exactly one row on wide screens.
const GRID_BY_COUNT = {
    1: "",
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 xl:grid-cols-3",
};

function resolveHref(href, workspaceSlug) {
    if (!href) return null;
    if (/^https:\/\//.test(href)) return { external: true, url: href };
    if (INTERNAL_PATH.test(href)) return { external: false, url: href.replace("{slug}", workspaceSlug) };
    return null;
}

// One "what's new" card: image (or an illustration fallback), a title, a one-line benefit and one CTA.
// `compact` is used when several share the row: a narrower image and a tighter layout.
function AnnouncementItem({ announcement, compact, onGone }) {
    const t = useTranslations("announcements");
    const locale = useLocale();
    const router = useRouter();
    const { workspaceSlug } = useParams();

    const isArabic = locale === "ar";
    const title = (isArabic && announcement.titleAr) || announcement.title;
    const body = (isArabic && announcement.bodyAr) || announcement.body;
    const ctaLabel = (isArabic && announcement.ctaLabelAr) || announcement.ctaLabel;
    const target = resolveHref(announcement.ctaHref, workspaceSlug);

    // Fire-and-forget: the card is hidden optimistically and a lost request only means it reappears next visit.
    const record = useCallback((action) => {
        api.post(`/api/announcements/${announcement.id}/dismiss`, { action }).catch(() => {});
    }, [announcement.id]);

    function handleDismiss() {
        record("dismissed");
        onGone(announcement.id);
    }

    function handleCta() {
        record("clicked");
        onGone(announcement.id);
        if (!target) return;
        if (target.external) window.open(target.url, "_blank", "noopener,noreferrer");
        else router.push(target.url);
    }

    return (
        <section
            aria-label={t("label")}
            className="relative flex h-full overflow-hidden rounded-2xl border border-border bg-card"
        >
            <div className={`hidden sm:block relative shrink-0 bg-primary/10 ${compact ? "w-28" : "w-56"}`}>
                {announcement.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded, resized server-side
                    <img src={announcement.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-primary">
                        <Sparkles size={compact ? 28 : 40} strokeWidth={1.5} />
                    </div>
                )}
            </div>

            <div className={`flex min-w-0 grow flex-col justify-center gap-1 pe-12 ${compact ? "p-4" : "p-5"}`}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">{t("badge")}</span>
                <h2 className="text-base font-semibold text-foreground truncate">{title}</h2>
                <p className={`text-sm text-muted-foreground ${compact ? "line-clamp-2" : "line-clamp-2 sm:line-clamp-1"}`}>{body}</p>
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

/**
 * The "what's new" row at the top of the dashboard: up to three announcements side by side (one fills
 * the row, two split it, three share it; they wrap on small screens). Dismissing one (or clicking its
 * CTA) removes it; the next waiting announcement fills the gap on the following visit. Dismissal is
 * stored per coach server-side, so it follows them across devices.
 *
 * Renders nothing while loading, on failure, or when there is nothing to show: a failed announcements
 * request must never affect the dashboard.
 */
export default function AnnouncementCard() {
    const [announcements, setAnnouncements] = useState([]);

    useEffect(() => {
        let active = true;
        api.get("/api/announcements/active")
            .then((res) => {
                if (!active) return;
                const list = res.data?.announcements ?? (res.data?.announcement ? [res.data.announcement] : []);
                setAnnouncements(list.slice(0, 3));
            })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    const removeAnnouncement = useCallback((id) => {
        setAnnouncements((current) => current.filter((item) => item.id !== id));
    }, []);

    // Phone carousel: which card is in view, for the dots under it.
    const trackRef = useRef(null);
    const [activeIndex, setActiveIndex] = useState(0);
    function handleScroll() {
        const track = trackRef.current;
        if (!track || !track.firstElementChild) return;
        const cardWidth = track.firstElementChild.getBoundingClientRect().width + CAROUSEL_GAP_PX;
        // scrollLeft is negative in right-to-left layouts, so use its size.
        setActiveIndex(Math.min(announcements.length - 1, Math.round(Math.abs(track.scrollLeft) / cardWidth)));
    }

    if (announcements.length === 0) return null;

    const isCarousel = announcements.length > 1;
    return (
        <div className="min-w-0">
            {/* Below md the cards form a swipeable carousel (each snaps into view, the next one peeks in);
                from md up they share the row as a grid. */}
            <div
                ref={trackRef}
                onScroll={handleScroll}
                className={`flex items-stretch gap-3 md:grid md:gap-4 ${isCarousel ? "overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] md:overflow-visible" : ""} ${GRID_BY_COUNT[announcements.length]}`}
            >
                {announcements.map((announcement) => (
                    <div key={announcement.id} className={`flex min-w-0 *:w-full ${isCarousel ? "shrink-0 basis-[88%] snap-center md:basis-auto" : "w-full"}`}>
                        <AnnouncementItem
                            announcement={announcement}
                            compact={isCarousel}
                            onGone={removeAnnouncement}
                        />
                    </div>
                ))}
            </div>
            {isCarousel && (
                <div className="mt-2 flex justify-center gap-1.5 md:hidden" aria-hidden="true">
                    {announcements.map((announcement, index) => (
                        <span key={announcement.id} className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-4 bg-primary" : "w-1.5 bg-default"}`} />
                    ))}
                </div>
            )}
        </div>
    );
}
