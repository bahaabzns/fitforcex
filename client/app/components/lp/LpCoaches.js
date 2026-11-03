'use client';

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { LANDING_COACHES, LANDING_SECTIONS } from "@/lib/landingConfig";

// lucide-react doesn't ship brand icons, so Instagram is an inline glyph.
function InstagramIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
    );
}

const STATS_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/plans/landing-stats`;
const STAT_KEYS = ["coaches", "clients", "plans"];

// Live totals from the platform itself (same source as the Super Admin dashboard). A stat that
// is missing or zero is simply not shown, and the whole strip hides if the request fails.
function useLandingStats() {
    const [stats, setStats] = useState(null);
    useEffect(() => {
        let active = true;
        fetch(STATS_URL)
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => { if (active) setStats(data); })
            .catch(() => { if (active) setStats(null); });
        return () => { active = false; };
    }, []);
    return stats;
}

export default function LpCoaches() {
    const t = useTranslations("lp.coaches");
    const stats = useLandingStats();
    const visibleStats = STAT_KEYS.filter((key) => Number(stats?.[key]) > 0);

    return (
        <section id={LANDING_SECTIONS.coaches} className="lp-section" style={{ scrollMarginTop: 90 }}>
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                {visibleStats.length > 0 && (
                    <dl className="lp-stats" aria-label={t("stats.label")}>
                        {visibleStats.map((key) => (
                            <div key={key}>
                                <dt>{t(`stats.${key}`)}</dt>
                                <dd>{Number(stats[key]).toLocaleString("en-US")}</dd>
                            </div>
                        ))}
                    </dl>
                )}

                <ul className="lp-coaches">
                    {LANDING_COACHES.map((coach) => {
                        const copy = t.raw(coach.id);
                        return (
                            <li key={coach.id} className="lp-glass lp-coach">
                                <div className="lp-coach__photo">
                                    {coach.image
                                        ? <Image src={coach.image} alt={copy.name || coach.instagramHandle} fill sizes="132px" />
                                        : <span className="lp-placeholder lp-coach__ph">{t("photoPlaceholder")}</span>}
                                </div>
                                <div className="lp-coach__body">
                                    <h3>{copy.name || <span className="lp-placeholder">{t("namePlaceholder")}</span>}</h3>
                                    <p>{copy.description || <span className="lp-placeholder">{t("bioPlaceholder")}</span>}</p>
                                    <a href={coach.instagramUrl} target="_blank" rel="noopener noreferrer" className="lp-coach__link" data-track="coach_instagram">
                                        <InstagramIcon width={18} height={18} />
                                        <span dir="ltr">{coach.instagramHandle}</span>
                                        <span className="sr-only">{t("instagram")}</span>
                                    </a>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}
