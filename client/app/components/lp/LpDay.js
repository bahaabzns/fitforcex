'use client';

import { useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChefHat, LineChart, UserPlus, Wallet } from "lucide-react";
import { LANDING_DAY_STEPS, LANDING_SECTIONS, LANDING_SHOTS } from "@/lib/landingConfig";
import { LpBrowser } from "./LpFrames";
import LpShotImage from "./LpShotImage";

// Same order as `lp.day.steps`.
const STEP_ICONS = [UserPlus, ChefHat, LineChart, Wallet];

// Every step is one dashboard screenshot in the same browser frame.
function StepVisual({ shotId, alt }) {
    return (
        <LpBrowser zoomHint={alt}>
            <LpShotImage shotId={shotId} alt={alt} />
        </LpBrowser>
    );
}

export default function LpDay() {
    const t = useTranslations("lp.day");
    const tUi = useTranslations("lp.ui");
    const isRtl = useLocale() === "ar";
    const steps = t.raw("steps");
    const labels = t.raw("labels");
    const tabs = t.raw("tabs");
    const [active, setActive] = useState(0);
    const tabRefs = useRef([]);

    // Arrow keys move between steps, like any tab list (the visual order flips in Arabic).
    function onKeyDown(event) {
        const forward = isRtl ? "ArrowLeft" : "ArrowRight";
        const back = isRtl ? "ArrowRight" : "ArrowLeft";
        const move = event.key === forward ? 1 : event.key === back ? -1 : 0;
        if (!move) return;
        event.preventDefault();
        const next = (active + move + steps.length) % steps.length;
        setActive(next);
        tabRefs.current[next]?.focus();
    }

    return (
        <section id={LANDING_SECTIONS.day} className="lp-section" style={{ scrollMarginTop: 90 }}>
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2" style={{ fontSize: "clamp(1.75rem, 1.6vw + 1rem, 2.75rem)" }}>{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                <div className="lp-day">
                <div className="lp-chips" role="tablist" aria-label={tUi("steps")} onKeyDown={onKeyDown}>
                    {steps.map((step, index) => {
                        const Icon = STEP_ICONS[index];
                        return (
                            <button
                                key={step.title}
                                type="button"
                                role="tab"
                                id={`day-tab-${index}`}
                                aria-selected={active === index}
                                aria-controls={`day-panel-${index}`}
                                tabIndex={active === index ? 0 : -1}
                                ref={(node) => { tabRefs.current[index] = node; }}
                                className={`lp-chip ${active === index ? "is-active" : ""}`}
                                onClick={() => setActive(index)}
                            >
                                <Icon size={20} aria-hidden="true" />
                                <span className="lp-chip__label">{labels[index]}</span>
                                <span className="lp-chip__title">{tabs[index]}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="lp-caption" aria-live="polite">
                    <strong>{steps[active].title}</strong>
                    <span>{steps[active].text}</span>
                    {active < steps.length - 1 && (
                        <button type="button" className="lp-caption__next" onClick={() => setActive(active + 1)}>{tUi("next")}</button>
                    )}
                </div>

                <div className="lp-stage">
                    {LANDING_DAY_STEPS.map((shotIds, index) => (
                        <div
                            key={shotIds.join("-")}
                            id={`day-panel-${index}`}
                            role="tabpanel"
                            aria-labelledby={`day-tab-${index}`}
                            className={`lp-stage__layer ${active === index ? "is-active" : ""}`}
                            aria-hidden={active !== index}
                        >
                            <StepVisual shotId={shotIds[0]} alt={steps[index].alt} />
                        </div>
                    ))}
                </div>
                </div>

                <div className="lp-day__cta">
                    <Link href="/register" className="lp-btn lp-btn--primary lp-btn--lg">{t("cta")}</Link>
                </div>
            </div>
        </section>
    );
}
