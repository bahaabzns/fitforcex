'use client';

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const STATS_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/plans/landing-stats`;
const STAT_KEYS = ["coaches", "clients", "plans"];
const COUNT_UP_MS = 1400;

// Live totals from the platform itself (same source as the Super Admin dashboard). A stat that
// is missing or zero is simply not shown, and the strip hides entirely if the request fails.
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

// Counts up from zero the first time it scrolls into view; reduced-motion users get the final number.
function CountUp({ value }) {
    const ref = useRef(null);
    const [shown, setShown] = useState(0);

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let frame = 0;
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            if (reduceMotion) { setShown(value); return; }
            const start = performance.now();
            const tick = (now) => {
                const progress = Math.min((now - start) / COUNT_UP_MS, 1);
                setShown(Math.round(value * (1 - (1 - progress) ** 3)));
                if (progress < 1) frame = requestAnimationFrame(tick);
            };
            frame = requestAnimationFrame(tick);
        }, { threshold: 0.6 });
        observer.observe(node);
        return () => { observer.disconnect(); cancelAnimationFrame(frame); };
    }, [value]);

    const format = (number) => number.toLocaleString("en-US");
    // The final number is rendered invisibly so the layout never jumps while counting.
    return (
        <span ref={ref} className="lp-count" dir="ltr">
            <span className="lp-count__size" aria-hidden="true">{format(value)}+</span>
            <span className="lp-count__live" aria-hidden="true">{format(shown)}+</span>
            <span className="sr-only">{format(value)}</span>
        </span>
    );
}

export default function LpStats() {
    const t = useTranslations("lp.coaches.stats");
    const stats = useLandingStats();
    const visible = STAT_KEYS.filter((key) => Number(stats?.[key]) > 0);
    if (visible.length === 0) return null;

    return (
        <section className="lp-stats-band" aria-label={t("label")}>
            <div className="lp-container lp-above">
                <p className="lp-stats__live"><span className="lp-stats__dot" aria-hidden="true" />{t("live")}</p>
                <dl className="lp-stats">
                    {visible.map((key) => (
                        <div key={key} className="lp-stat">
                            <dt>{t(key)}</dt>
                            <dd><CountUp value={Number(stats[key])} /></dd>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    );
}
