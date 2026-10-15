"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";

const INTERNAL_PORTAL_PATH = /^\/portal(\/[A-Za-z0-9_-]+)*$/;

function BannerSlide({ banner, index, total, label }) {
    const content = (
        <>
            {/* eslint-disable-next-line @next/next/no-img-element -- coach-uploaded, resized server-side */}
            <img
                src={banner.imageUrl}
                alt={banner.title || label}
                className="absolute inset-0 w-full h-full object-cover"
                loading={index === 0 ? "eager" : "lazy"}
                draggable={false}
            />
            {banner.title && (
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-4 pt-8 pb-3">
                    <p className="text-white text-sm font-semibold line-clamp-2">{banner.title}</p>
                </div>
            )}
        </>
    );
    const className = "relative block shrink-0 w-full snap-center aspect-3/1 overflow-hidden rounded-xl bg-default";
    const ariaProps = { role: "group", "aria-roledescription": "slide", "aria-label": `${index + 1} / ${total}` };

    if (banner.linkUrl && INTERNAL_PORTAL_PATH.test(banner.linkUrl)) {
        return <Link href={banner.linkUrl} className={className} {...ariaProps}>{content}</Link>;
    }
    // Server only ever stores https:// or /portal/... links; re-check so a bad value can't render.
    if (banner.linkUrl && /^https:\/\//.test(banner.linkUrl)) {
        return (
            <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className={className} {...ariaProps}>
                {content}
            </a>
        );
    }
    return <div className={className} {...ariaProps}>{content}</div>;
}

/**
 * Coach banners on the portal home. Renders nothing when there are none (no plan, no banners,
 * or branding hidden by plan/expiry), so the page is unchanged for non-branded workspaces.
 */
export default function PortalBanners() {
    const t = useTranslations("portal.home");
    const [banners, setBanners] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const trackRef = useRef(null);

    useEffect(() => {
        let active = true;
        api.get("/api/client-portal/branding")
            .then(res => { if (active) setBanners(res.data?.banners ?? []); })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    const handleScroll = useCallback(() => {
        const track = trackRef.current;
        if (!track || track.clientWidth === 0) return;
        // abs(): scrollLeft is negative in RTL
        setActiveIndex(Math.round(Math.abs(track.scrollLeft) / track.clientWidth));
    }, []);

    const goTo = useCallback((index) => {
        trackRef.current?.children[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, []);

    if (banners.length === 0) return null;

    return (
        <section aria-roledescription="carousel" aria-label={t("bannersLabel")} className="flex flex-col gap-2">
            <div
                ref={trackRef}
                onScroll={handleScroll}
                className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {banners.map((banner, index) => (
                    <BannerSlide key={banner.id} banner={banner} index={index} total={banners.length} label={t("bannerFallbackAlt")} />
                ))}
            </div>
            {banners.length > 1 && (
                <div className="flex justify-center gap-1.5">
                    {banners.map((banner, index) => (
                        <button
                            key={banner.id}
                            type="button"
                            onClick={() => goTo(index)}
                            aria-label={t("bannerGoTo", { number: index + 1 })}
                            aria-current={index === activeIndex}
                            className={`h-1.5 rounded-full border-0 p-0 transition-all ${
                                index === activeIndex ? "w-5 bg-(--brand-secondary,var(--primary))" : "w-1.5 bg-border"
                            }`}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
