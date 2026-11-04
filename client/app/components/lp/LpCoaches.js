'use client';

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { LANDING_COACHES, LANDING_SECTIONS } from "@/lib/landingConfig";

const AUTOPLAY_MS = 5000;

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

// Cinematic spotlight: one coach fills the stage, the rest sit in a selector strip underneath.
// It rotates on its own until the visitor hovers, focuses or presses pause (or prefers reduced motion).
export default function LpCoaches() {
    const t = useTranslations("lp.coaches");
    const isRtl = useLocale() === "ar";
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);
    const [engaged, setEngaged] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(true);
    const tabRefs = useRef([]);
    const count = LANDING_COACHES.length;

    useEffect(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => setReduceMotion(query.matches);
        sync();
        query.addEventListener("change", sync);
        return () => query.removeEventListener("change", sync);
    }, []);

    useEffect(() => {
        if (paused || engaged || reduceMotion) return undefined;
        const timer = setInterval(() => setActive((index) => (index + 1) % count), AUTOPLAY_MS);
        return () => clearInterval(timer);
    }, [paused, engaged, reduceMotion, count, active]);

    const go = (index) => setActive((index + count) % count);

    function onKeyDown(event) {
        const forward = isRtl ? "ArrowLeft" : "ArrowRight";
        const back = isRtl ? "ArrowRight" : "ArrowLeft";
        const move = event.key === forward ? 1 : event.key === back ? -1 : 0;
        if (!move) return;
        event.preventDefault();
        const next = (active + move + count) % count;
        setActive(next);
        tabRefs.current[next]?.focus();
    }

    const Next = isRtl ? ArrowLeft : ArrowRight;
    const Prev = isRtl ? ArrowRight : ArrowLeft;

    return (
        <section id={LANDING_SECTIONS.coaches} className="lp-section lp-cs-sec" style={{ scrollMarginTop: 90 }}>
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                <div
                    className="lp-cs"
                    onMouseEnter={() => setEngaged(true)}
                    onMouseLeave={() => setEngaged(false)}
                    onFocus={() => setEngaged(true)}
                    onBlur={() => setEngaged(false)}
                >
                    <div className="lp-cs__stage">
                        {LANDING_COACHES.map((coach, index) => {
                            const copy = t.raw(coach.id);
                            const isActive = index === active;
                            return (
                                <article
                                    key={coach.id}
                                    id={`coach-panel-${index}`}
                                    role="tabpanel"
                                    aria-labelledby={`coach-tab-${index}`}
                                    aria-hidden={!isActive}
                                    className={`lp-cs__slide ${isActive ? "is-active" : ""}`}
                                >
                                    {coach.image && <Image className="lp-cs__bg" src={coach.image} alt="" fill sizes="50vw" />}
                                    <span className="lp-cs__bgshade" aria-hidden="true" />
                                    <div className="lp-cs__photo">
                                        {coach.image
                                            ? <Image src={coach.image} alt={`${t("prefix")} ${copy.name}`} fill sizes="(min-width: 800px) 700px, 100vw" priority={index === 0} unoptimized />
                                            : <span className="lp-placeholder lp-coach__ph">{t("photoPlaceholder")}</span>}
                                    </div>
                                    <div className="lp-cs__text">
                                        <span className="lp-cs__count" dir="ltr" aria-hidden="true">{String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span>
                                        <span className="lp-cs__role">{t("prefix")}</span>
                                        <h3 className="lp-cs__name">{copy.name}</h3>
                                        <a
                                            href={coach.instagramUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="lp-cs__cta"
                                            tabIndex={isActive ? 0 : -1}
                                            data-track="coach_instagram"
                                        >
                                            <InstagramIcon width={20} height={20} />
                                            <span dir="ltr">{coach.instagramHandle}</span>
                                            <span className="sr-only">{t("instagram")}</span>
                                        </a>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <div className="lp-cs__bar">
                        <button type="button" className="lp-cs__arrow" onClick={() => go(active - 1)} aria-label={t("previous")}>
                            <Prev size={20} aria-hidden="true" />
                        </button>
                        <div className="lp-cs__tabs" role="tablist" aria-label={t("title")} onKeyDown={onKeyDown}>
                            {LANDING_COACHES.map((coach, index) => (
                                <button
                                    key={coach.id}
                                    type="button"
                                    role="tab"
                                    id={`coach-tab-${index}`}
                                    aria-selected={index === active}
                                    aria-controls={`coach-panel-${index}`}
                                    tabIndex={index === active ? 0 : -1}
                                    ref={(node) => { tabRefs.current[index] = node; }}
                                    className={`lp-cs__tab ${index === active ? "is-active" : ""}`}
                                    onClick={() => setActive(index)}
                                    aria-label={`${t("prefix")} ${t.raw(coach.id).name}`}
                                >
                                    {coach.image && <Image src={coach.image} alt="" fill sizes="72px" />}
                                </button>
                            ))}
                        </div>
                        <button type="button" className="lp-cs__arrow" onClick={() => go(active + 1)} aria-label={t("next")}>
                            <Next size={20} aria-hidden="true" />
                        </button>
                        {!reduceMotion && (
                            <button type="button" className="lp-cs__arrow lp-cs__pause" onClick={() => setPaused((value) => !value)} aria-label={paused ? t("play") : t("pause")} aria-pressed={paused}>
                                {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
