'use client';

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LANDING_DAY_STEPS, LANDING_SECTIONS, LANDING_SHOTS } from "@/lib/landingConfig";
import { LpBrowser, LpPhoneFrame } from "./LpFrames";
import LpShotImage from "./LpShotImage";

const SPY_LOCK_MS = 1200;

// One large screenshot stage on one side, the five steps on the other. Clicking a step, or
// scrolling past it, switches the stage; every step uses the same stage size.
function StepVisual({ shotIds, alt }) {
    if (shotIds.length === 1 && LANDING_SHOTS[shotIds[0]].kind === "browser") {
        return (
            <LpBrowser>
                <LpShotImage shotId={shotIds[0]} alt={alt} />
            </LpBrowser>
        );
    }
    return (
        <div className="lp-stage__phones">
            {shotIds.map((id, index) => (
                <LpPhoneFrame key={id}>
                    <LpShotImage shotId={id} alt={index === 0 ? alt : ""} />
                </LpPhoneFrame>
            ))}
        </div>
    );
}

export default function LpDay() {
    const t = useTranslations("lp.day");
    const tUi = useTranslations("lp.ui");
    const steps = t.raw("steps");
    const [active, setActive] = useState(0);
    const rowRefs = useRef([]);
    // A click wins over scroll-spy for a moment, so the scroll it causes can't switch the step back.
    const spyLocked = useRef(false);
    const lockTimer = useRef(null);
    const choose = (index) => {
        spyLocked.current = true;
        clearTimeout(lockTimer.current);
        lockTimer.current = setTimeout(() => { spyLocked.current = false; }, SPY_LOCK_MS);
        setActive(index);
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !spyLocked.current) setActive(Number(entry.target.dataset.step));
                });
            },
            { rootMargin: "-42% 0px -42% 0px" }
        );
        rowRefs.current.forEach((row) => row && observer.observe(row));
        return () => { observer.disconnect(); clearTimeout(lockTimer.current); };
    }, []);

    return (
        <section id={LANDING_SECTIONS.day} className="lp-section" style={{ scrollMarginTop: 90 }}>
            <div className="lp-container lp-above">
                <div className="lp-head">
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                {/* Phones: tap or swipe through numbered chips. */}
                <div className="lp-chips" role="tablist" aria-label={tUi("steps")}>
                    {steps.map((step, index) => (
                        <button
                            key={step.title}
                            type="button"
                            role="tab"
                            aria-selected={active === index}
                            className={`lp-chip ${active === index ? "is-active" : ""}`}
                            onClick={() => choose(index)}
                        >
                            {String(index + 1).padStart(2, "0")}
                        </button>
                    ))}
                </div>

                <div className="lp-day">
                    <ol className="lp-day__list">
                        {steps.map((step, index) => (
                            <li key={step.title} ref={(node) => { rowRefs.current[index] = node; }} data-step={index}>
                                <button
                                    type="button"
                                    className={`lp-glass lp-stepbtn ${active === index ? "is-active" : ""}`}
                                    aria-current={active === index ? "step" : undefined}
                                    onClick={() => choose(index)}
                                >
                                    <span className="lp-num lp-grad" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                                    <span className="lp-stepbtn__copy">
                                        <strong>{step.title}</strong>
                                        <span>{step.text}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ol>

                    <div className="lp-stage">
                        {LANDING_DAY_STEPS.map((shotIds, index) => (
                            <div key={shotIds.join("-")} className={`lp-stage__layer ${active === index ? "is-active" : ""}`} aria-hidden={active !== index}>
                                <StepVisual shotIds={shotIds} alt={steps[index].alt} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lp-caption" aria-live="polite">
                    <strong>{steps[active].title}</strong>
                    <span>{steps[active].text}</span>
                </div>
            </div>
        </section>
    );
}
