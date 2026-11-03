'use client';

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Dumbbell, Users } from "lucide-react";

const STATS_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/plans/landing-stats`;
const STATS = [
    { key: "coaches", Icon: Dumbbell },
    { key: "clients", Icon: Users },
    { key: "plans", Icon: ClipboardList },
];

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

export default function LpStats() {
    const t = useTranslations("lp.coaches.stats");
    const stats = useLandingStats();
    const visible = STATS.filter(({ key }) => Number(stats?.[key]) > 0);
    if (visible.length === 0) return null;

    return (
        <section className="lp-stats-band" aria-label={t("label")}>
            <div className="lp-container lp-above">
                <dl className="lp-stats">
                    {visible.map(({ key, Icon }) => (
                        <div key={key} className="lp-glass lp-stat">
                            <Icon size={22} aria-hidden="true" />
                            <dt>{t(key)}</dt>
                            <dd dir="ltr">{Number(stats[key]).toLocaleString("en-US")}<span aria-hidden="true">+</span></dd>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    );
}
