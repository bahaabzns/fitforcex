'use client';

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChefHat, LineChart, UserPlus, Wallet } from "lucide-react";
import { LANDING_DAY_STEPS } from "@/lib/landingConfig";
import { LpBrowser } from "./LpFrames";
import LpShotImage from "./LpShotImage";

// Same order as `lp.day.steps`.
const STEP_ICONS = [UserPlus, ChefHat, LineChart, Wallet];
// Distance from the top of the viewport where the pinned stage sticks (below the floating nav).
const STICKY_TOP_PX = 96;

// Scroll-driven version of the day section (desktop, tall screens): the stage stays pinned while
// a traveler icon rides a vertical timeline and the screenshot changes with it.
export default function LpDayJourney() {
    const t = useTranslations("lp.day");
    const tUi = useTranslations("lp.ui");
    const steps = t.raw("steps");
    const [active, setActive] = useState(0);
    const trackRef = useRef(null);
    const stickyRef = useRef(null);
    const lastActiveRef = useRef(0);

    useEffect(() => {
        const track = trackRef.current;
        const sticky = stickyRef.current;
        if (!track || !sticky) return undefined;
        let frame = 0;

        const update = () => {
            frame = 0;
            const range = track.offsetHeight - sticky.offsetHeight;
            if (range <= 0) return; // hidden (phones, short screens): the tab layout is shown instead
            const scrolled = STICKY_TOP_PX - track.getBoundingClientRect().top;
            const progress = Math.min(Math.max(scrolled / range, 0), 1);
            track.style.setProperty("--p", progress.toFixed(4));
            const index = Math.round(progress * (steps.length - 1));
            if (index !== lastActiveRef.current) {
                lastActiveRef.current = index;
                setActive(index);
            }
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

        schedule();
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        return () => {
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            cancelAnimationFrame(frame);
        };
    }, [steps.length]);

    // Clicking a stop scrolls to the point where the traveler reaches it.
    function goTo(index) {
        const track = trackRef.current;
        const sticky = stickyRef.current;
        if (!track || !sticky) return;
        const range = track.offsetHeight - sticky.offsetHeight;
        const trackTop = window.scrollY + track.getBoundingClientRect().top;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({
            top: trackTop - STICKY_TOP_PX + (index / (steps.length - 1)) * range + 1,
            behavior: reduceMotion ? "auto" : "smooth",
        });
    }

    const TravelerIcon = STEP_ICONS[active];

    return (
        <div className="lp-journey" ref={trackRef} style={{ "--n": steps.length, "--p": 0 }}>
            <div className="lp-journey__sticky" ref={stickyRef}>
                <nav className="lp-jt" aria-label={tUi("steps")}>
                    <span className="lp-jt__line" aria-hidden="true" />
                    <span className="lp-jt__fill" aria-hidden="true" />
                    <span className="lp-jt__traveler" aria-hidden="true"><TravelerIcon size={22} /></span>
                    <ol>
                        {steps.map((step, index) => (
                            <li key={step.title} className={active === index ? "is-active" : index < active ? "is-done" : ""}>
                                <button type="button" onClick={() => goTo(index)} aria-current={active === index ? "step" : undefined}>
                                    <span className="lp-jt__dot" aria-hidden="true" />
                                    <span className="lp-jt__copy">
                                        <strong>{step.title}</strong>
                                        <span>{step.text}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ol>
                </nav>

                {/* Phones have no room beside the timeline, so the active step's text sits under it. */}
                <p className="lp-jcap" aria-live="polite">{steps[active].text}</p>

                <div className="lp-jstage">
                    <div className="lp-stage">
                        {LANDING_DAY_STEPS.map((shotIds, index) => (
                            <div key={shotIds.join("-")} className={`lp-stage__layer ${active === index ? "is-active" : ""}`} aria-hidden={active !== index}>
                                <LpBrowser zoomHint={steps[index].alt}>
                                    <LpShotImage shotId={shotIds[0]} alt={steps[index].alt} />
                                </LpBrowser>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
