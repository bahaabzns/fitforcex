'use client';

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Chip } from "@heroui/react/chip";
import { useScrollReveal } from "@/lib/useScrollReveal";

const SCREENSHOTS = {
    feature1: "/unlimited.png",
    feature2: "/Untitled-1.png",
    feature3: "/delivery.png",
    feature4: "/library.png",
    feature5: "/Client Progress Tracking.png",
    feature6: "/EasyToUse.png",
};

// Double-checkmark bullet icon, matching the old design's bullet treatment.
function DoubleCheckIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true">
            <path d="M2 12.5l4 4 8-8" stroke="var(--color-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
            <path d="M7 12.5l4 4 8-8" stroke="var(--color-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function FeatureSection({ featureKey, reversed, dimBg, ctaLabel, noCreditCardLabel }) {
    const t = useTranslations(`landing.features.${featureKey}`);
    const bullets = t.raw("bullets");
    const textRef = useScrollReveal();
    const imageRef = useScrollReveal();

    return (
        <section
            className="py-16 md:py-24 px-6"
            style={dimBg ? { background: "rgba(255,255,255,0.015)" } : undefined}
        >
            <div
                className={`mx-auto max-w-7xl flex flex-col gap-14 items-center ${
                    reversed ? "md:flex-row-reverse" : "md:flex-row"
                }`}
            >
                {/* ── Text block ── */}
                <div
                    ref={textRef}
                    className={`animate-on-scroll ${reversed ? "fade-in-right" : "fade-in-left"} flex-1 flex flex-col gap-6 max-w-lg`}
                >
                    <Chip color="accent" size="sm">
                        {t("category")}
                    </Chip>
                    <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                        {t("title")}
                    </h2>
                    <ul className="flex flex-col gap-4">
                        {bullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <DoubleCheckIcon />
                                <span className="text-white/60 leading-relaxed">{b}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-col gap-2 mt-2">
                        <Link
                            href="/register"
                            className="button button--primary button--md w-fit"
                        >
                            {ctaLabel}
                        </Link>
                        <p className="text-white/50 text-sm">✓ {noCreditCardLabel}</p>
                    </div>
                </div>

                {/* ── Image block ── */}
                <div
                    ref={imageRef}
                    className={`animate-on-scroll ${reversed ? "fade-in-left" : "fade-in-right"} flex-1 w-full`}
                >
                    <div
                        className="rounded-2xl border border-white/10 overflow-hidden"
                        style={{
                            boxShadow:
                                "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
                        }}
                    >
                        <img
                            src={SCREENSHOTS[featureKey]}
                            alt={t("title")}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function LandingFeatures() {
    const tHero = useTranslations("landing.hero");
    const ctaLabel = tHero("cta");
    const noCreditCardLabel = tHero("noCreditCard");

    return (
        <div id="features">
            <FeatureSection featureKey="feature1" reversed={false} dimBg={false} ctaLabel={ctaLabel} noCreditCardLabel={noCreditCardLabel} />
            <FeatureSection featureKey="feature2" reversed={true} dimBg={true} ctaLabel={ctaLabel} noCreditCardLabel={noCreditCardLabel} />
            <FeatureSection featureKey="feature3" reversed={false} dimBg={false} ctaLabel={ctaLabel} noCreditCardLabel={noCreditCardLabel} />
            <FeatureSection featureKey="feature4" reversed={true} dimBg={true} ctaLabel={ctaLabel} noCreditCardLabel={noCreditCardLabel} />
            <FeatureSection featureKey="feature5" reversed={false} dimBg={false} ctaLabel={ctaLabel} noCreditCardLabel={noCreditCardLabel} />
            <FeatureSection featureKey="feature6" reversed={true} dimBg={true} ctaLabel={ctaLabel} noCreditCardLabel={noCreditCardLabel} />
        </div>
    );
}
