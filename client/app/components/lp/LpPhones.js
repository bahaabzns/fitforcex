'use client';

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { LANDING_PHONE_SCREENS, LANDING_SECTIONS } from "@/lib/landingConfig";
import { LpPhoneFrame } from "./LpFrames";
import LpZoomImage from "./LpZoomImage";

const SWIPE_MIN_PX = 40;

// All the client-app screens in one phone: swipe, tap the arrows or tap a dot.
export default function LpPhones() {
    const t = useTranslations("lp.phones");
    const tUi = useTranslations("lp.ui");
    const screens = t.raw("screens");
    const bullets = t.raw("bullets");
    const [active, setActive] = useState(0);
    const swipeStart = useRef(null);
    const count = LANDING_PHONE_SCREENS.length;

    const go = (next) => setActive((next + count) % count);

    function onPointerDown(event) { swipeStart.current = event.clientX; }
    function onPointerUp(event) {
        if (swipeStart.current == null) return;
        const delta = event.clientX - swipeStart.current;
        swipeStart.current = null;
        // Direction follows the page: swiping toward the start edge goes forward in RTL too.
        if (Math.abs(delta) >= SWIPE_MIN_PX) go(active + (delta < 0 ? 1 : -1) * (document.dir === "rtl" ? -1 : 1));
    }

    return (
        <section id={LANDING_SECTIONS.app} className="lp-section" style={{ scrollMarginTop: 90 }}>
            <div className="lp-glow" style={{ top: "0%", insetInlineEnd: "-15%" }} aria-hidden="true" />
            <div className="lp-container lp-above">
                <div className="lp-phones-sec">
                    <div className="lp-hero__copy">
                        <h2 className="lp-h2">{t("title")}</h2>
                        <p className="lp-lead">{t("subtitle")}</p>
                        <ul className="lp-list">
                            {bullets.map((bullet) => (
                                <li key={bullet}><Check size={20} aria-hidden="true" />{bullet}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="lp-showcase" role="group" aria-roledescription="carousel" aria-label={tUi("screens")}>
                        <div className="lp-showcase__phone" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipeStart.current = null; }}>
                            <LpPhoneFrame>
                                {LANDING_PHONE_SCREENS.map((id, index) => (
                                    <div key={id} className={`lp-slide ${active === index ? "is-active" : ""}`} aria-hidden={active !== index}>
                                        <LpZoomImage shotId={id} alt={screens[index].alt} />
                                    </div>
                                ))}
                            </LpPhoneFrame>
                        </div>

                        <div className="lp-showcase__caption" aria-live="polite">
                            <strong>{screens[active].title}</strong>
                            <span>{screens[active].text}</span>
                        </div>

                        <div className="lp-showcase__nav">
                            <button type="button" className="lp-arrow" onClick={() => go(active - 1)} aria-label={tUi("prev")}>
                                <ChevronLeft size={20} aria-hidden="true" className="rtl:rotate-180" />
                            </button>
                            <div className="lp-dots">
                                {LANDING_PHONE_SCREENS.map((id, index) => (
                                    <button key={id} type="button" className={`lp-dot ${active === index ? "is-active" : ""}`} onClick={() => setActive(index)} aria-label={screens[index].title} aria-current={active === index} />
                                ))}
                            </div>
                            <button type="button" className="lp-arrow" onClick={() => go(active + 1)} aria-label={tUi("next")}>
                                <ChevronRight size={20} aria-hidden="true" className="rtl:rotate-180" />
                            </button>
                        </div>
                        <p className="lp-showcase__hint">{t("hint")}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
