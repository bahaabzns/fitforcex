'use client';

import { useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChefHat, LineChart, UserPlus, Wallet } from "lucide-react";
import { LANDING_DAY_SCOPES, LANDING_DAY_STEPS, LANDING_SECTIONS, LANDING_SHOTS } from "@/lib/landingConfig";
import { LpBrowser, LpPhoneFrame } from "./LpFrames";
import LpShotImage from "./LpShotImage";

// Same order as `lp.day.steps`; used by the phone chips.
const STEP_ICONS = [UserPlus, ChefHat, LineChart, Wallet];

// One stage for every step: same frame, same shape. Phones sit inside it for the client-app step.
function StepVisual({ shotIds, alt, scopeLabel }) {
    const isBrowser = shotIds.length === 1 && LANDING_SHOTS[shotIds[0]].kind === "browser";
    return (
        <>
            <LpBrowser className={isBrowser ? "" : "lp-stage__panel"}>
                {isBrowser ? (
                    <LpShotImage shotId={shotIds[0]} alt={alt} />
                ) : (
                    <div className="lp-stage__phones">
                        {shotIds.map((id, index) => (
                            <LpPhoneFrame key={id}>
                                <LpShotImage shotId={id} alt={index === 0 ? alt : ""} />
                            </LpPhoneFrame>
                        ))}
                    </div>
                )}
            </LpBrowser>
            {/* Under the frame, so it never covers the screenshot. */}
            <span className="lp-scope">{scopeLabel}</span>
        </>
    );
}

export default function LpDay() {
    const t = useTranslations("lp.day");
    const tUi = useTranslations("lp.ui");
    const steps = t.raw("steps");
    const labels = t.raw("labels");
    const [active, setActive] = useState(0);
    const tabRefs = useRef([]);
    const choose = (index) => setActive(index);

    // Arrow keys move between steps, like any tab list.
    function onKeyDown(event) {
        const move = { ArrowDown: 1, ArrowUp: -1 }[event.key];
        if (!move) return;
        event.preventDefault();
        const next = (active + move + steps.length) % steps.length;
        choose(next);
        tabRefs.current[next]?.focus();
    }

    return (
        <section id={LANDING_SECTIONS.day} className="lp-section" style={{ scrollMarginTop: 90 }}>
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2" style={{ fontSize: "clamp(1.75rem, 1.6vw + 1rem, 2.75rem)" }}>{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                {/* Phones: tap an icon to switch the step. */}
                <div className="lp-chips" role="tablist" aria-label={tUi("steps")}>
                    {steps.map((step, index) => {
                        const Icon = STEP_ICONS[index];
                        return (
                            <button
                                key={step.title}
                                type="button"
                                role="tab"
                                aria-selected={active === index}
                                aria-label={step.title}
                                className={`lp-chip ${active === index ? "is-active" : ""}`}
                                onClick={() => choose(index)}
                            >
                                <Icon size={20} aria-hidden="true" />
                                <span>{labels[index]}</span>
                            </button>
                        );
                    })}
                </div>

                <p className="lp-day__hint">{t("hint")}</p>

                <div className="lp-day">
                    <ol className="lp-day__list" role="tablist" aria-orientation="vertical" aria-label={tUi("steps")} onKeyDown={onKeyDown}>
                        {steps.map((step, index) => (
                            <li key={step.title} data-active={active === index} role="presentation">
                                <button
                                    type="button"
                                    role="tab"
                                    id={`day-tab-${index}`}
                                    aria-selected={active === index}
                                    aria-controls={`day-panel-${index}`}
                                    tabIndex={active === index ? 0 : -1}
                                    ref={(node) => { tabRefs.current[index] = node; }}
                                    className={`lp-glass lp-stepbtn ${active === index ? "is-active" : ""}`}
                                    onClick={() => choose(index)}
                                >
                                    <span className="lp-num lp-grad" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                                    <span className="lp-stepbtn__copy">
                                        <strong>{step.title}</strong>
                                        <span className="lp-stepbtn__text"><span>{step.text}</span></span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ol>

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
                                <StepVisual shotIds={shotIds} alt={steps[index].alt} scopeLabel={t(LANDING_DAY_SCOPES[index])} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lp-caption" aria-live="polite">
                    <strong>{steps[active].title}</strong>
                    <span>{steps[active].text}</span>
                    {active < steps.length - 1 && (
                        <button type="button" className="lp-caption__next" onClick={() => choose(active + 1)}>{tUi("next")}</button>
                    )}
                </div>

                <div className="lp-day__cta">
                    <Link href="/register" className="lp-btn lp-btn--primary lp-btn--lg">{t("cta")}</Link>
                </div>
            </div>
        </section>
    );
}
