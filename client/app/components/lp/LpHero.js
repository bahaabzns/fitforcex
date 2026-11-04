'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Play } from "lucide-react";
import { assetUrl } from "@/lib/landingConfig";
import LpShot from "./LpShot";
import { LpPhoneFrame } from "./LpFrames";
import LpShotImage from "./LpShotImage";
import LpDemoModal from "./LpDemoModal";

export default function LpHero({ dashboardUrl }) {
    const t = useTranslations("lp.hero");
    const tNav = useTranslations("lp.nav");
    const locale = useLocale();
    const [demoOpen, setDemoOpen] = useState(false);
    const stageRef = useRef(null);

    // The dashboard starts laid back in perspective and levels out as the page scrolls.
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return undefined;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            stage.style.setProperty("--tilt", "0.45");
            return undefined;
        }
        let frame = 0;
        const update = () => {
            frame = 0;
            stage.style.setProperty("--tilt", Math.max(0, 1 - window.scrollY / 520).toFixed(3));
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
        schedule();
        window.addEventListener("scroll", schedule, { passive: true });
        return () => {
            window.removeEventListener("scroll", schedule);
            cancelAnimationFrame(frame);
        };
    }, []);

    return (
        <section className="lp-section lp-hero">
            <div className="lp-glow" style={{ top: -240, left: "50%", translate: "-50% 0" }} aria-hidden="true" />
            <div className="lp-container lp-above">
                <div className="lp-hero__grid">
                    <div className="lp-hero__copy lp-center">
                        <h1>
                            {t("title")} <span className="lp-grad">{t("highlight")}</span>
                        </h1>
                        <p className="lp-lead" style={{ maxWidth: "40rem" }}>{t("subtitle")}</p>
                        <div className="lp-hero__actions">
                            <Link href={dashboardUrl || "/register"} id="lp-hero-cta" className="lp-btn lp-btn--primary lp-btn--lg">
                                {dashboardUrl ? tNav("dashboard") : t("cta")}
                            </Link>
                            <button type="button" className="lp-btn lp-btn--glass lp-btn--lg" onClick={() => setDemoOpen(true)}>
                                <Play size={18} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                                {t("secondary")}
                            </button>
                        </div>
                        {!dashboardUrl && <p className="lp-hero__note">{t("note")}</p>}
                    </div>

                    <div className="lp-hero__shot lp-hero__shot--epic lp-rise" ref={stageRef}>
                        <div className="lp-epic">
                            <span className="lp-epic__beam" aria-hidden="true" />
                            <div className="lp-epic__tilt">
                                <LpShot src={assetUrl(`/lp/${locale}-dashboard.webp`)} alt={t("imageAlt")} sizes="(min-width: 1200px) 1240px, 100vw" priority />
                            </div>
                            <div className="lp-epic__phone" aria-hidden="true">
                                <LpPhoneFrame>
                                    <LpShotImage shotId="phoneNutrition" alt="" />
                                </LpPhoneFrame>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <LpDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
        </section>
    );
}
