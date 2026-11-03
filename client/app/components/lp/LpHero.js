'use client';

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { LANDING_SECTIONS } from "@/lib/landingConfig";
import LpShot from "./LpShot";

export default function LpHero({ dashboardUrl }) {
    const t = useTranslations("lp.hero");
    const tNav = useTranslations("lp.nav");
    const locale = useLocale();

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
                            <Link href={dashboardUrl || "/register"} className="lp-btn lp-btn--primary lp-btn--lg">
                                {dashboardUrl ? tNav("dashboard") : t("cta")}
                            </Link>
                            <a href={`#${LANDING_SECTIONS.day}`} className="lp-btn lp-btn--glass lp-btn--lg">{t("secondary")}</a>
                        </div>
                        {!dashboardUrl && <p className="lp-hero__note">{t("note")}</p>}
                    </div>

                    <div className="lp-hero__shot lp-rise">
                        <LpShot src={`/lp/${locale}-dashboard.webp`} alt={t("imageAlt")} priority sizes="(min-width: 1200px) 1100px, 100vw" />
                    </div>
                </div>
            </div>
        </section>
    );
}
