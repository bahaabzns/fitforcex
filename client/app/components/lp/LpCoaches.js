'use client';

import { useEffect, useRef, useState } from "react";
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

// Flips to true the first time the element is on screen, so the cards can rise in once.
function useRevealOnce() {
    const ref = useRef(null);
    const [seen, setSeen] = useState(false);
    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            setSeen(true);
            observer.disconnect();
        }, { threshold: 0.12 });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);
    return [ref, seen];
}

export default function LpCoaches() {
    const t = useTranslations("lp.coaches");
    const [listRef, seen] = useRevealOnce();

    return (
        <section id={LANDING_SECTIONS.coaches} className="lp-section lp-coaches-sec" style={{ scrollMarginTop: 90 }}>
            <div className="lp-glow lp-glow--soft lp-coaches-sec__glow" aria-hidden="true" />
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                <ul className={`lp-coaches ${seen ? "is-in" : ""}`} ref={listRef}>
                    {LANDING_COACHES.map((coach, index) => {
                        const copy = t.raw(coach.id);
                        return (
                            <li key={coach.id} style={{ "--i": index }}>
                                <a href={coach.instagramUrl} target="_blank" rel="noopener noreferrer" className="lp-coach" data-track="coach_instagram">
                                    {coach.image
                                        ? <Image src={coach.image} alt="" fill sizes="(min-width: 1100px) 360px, (min-width: 800px) 45vw, 48vw" />
                                        : <span className="lp-placeholder lp-coach__ph">{t("photoPlaceholder")}</span>}
                                    <span className="lp-coach__shade" aria-hidden="true" />
                                    <span className="lp-coach__info">
                                        <strong>{copy.name}</strong>
                                        <span className="lp-coach__handle" dir="ltr">
                                            <InstagramIcon width={16} height={16} />
                                            {coach.instagramHandle}
                                        </span>
                                    </span>
                                    <span className="sr-only">{t("instagram")}</span>
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}
