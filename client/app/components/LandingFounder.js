'use client';

import { useTranslations } from "next-intl";
import { Chip } from "@heroui/react/chip";
import { CheckCircle2 } from 'lucide-react';

export default function LandingFounder() {
    const t = useTranslations("landing.founder");
    const guaranteeBullets = t.raw("guarantees");

    return (
        <section id="founder" className="py-16 md:py-24 px-6">
            <div className="mx-auto max-w-6xl flex flex-col gap-12">

                {/* ── Heading ── */}
                <div className="text-center flex flex-col gap-4">
                    <Chip color="accent" size="sm" className="mx-auto">
                        {t("title")}
                    </Chip>
                    <h2 className="text-4xl sm:text-5xl font-bold text-white">
                        {t("title")}
                    </h2>
                    <p className="text-white/50 max-w-xl mx-auto leading-relaxed">
                        {t("subtitle")}
                    </p>
                </div>

                {/* ── Two-column card ── */}
                <div
                    className="rounded-2xl border border-white/10 overflow-hidden grid grid-cols-1 md:grid-cols-2"
                    style={{
                        background: "rgba(255,255,255,0.03)",
                        boxShadow:
                            "0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.4), 0 0 50px color-mix(in oklch, var(--color-primary) 6%, transparent)",
                    }}
                >
                    {/* ── Left: founder video ── */}
                    <div className="relative min-h-80 md:min-h-0 overflow-hidden">
                        <video
                            src="/founder_video.mp4"
                            poster="/founderbahaa.png"
                            controls
                            preload="metadata"
                            className="w-full h-full object-cover absolute inset-0"
                        />

                        {/* Bottom overlay with chip + name */}
                        <div className="absolute bottom-0 left-0 right-0 z-10 p-6 flex flex-col gap-3 border-t border-white/8 bg-black/50 backdrop-blur-sm pointer-events-none">
                            <div>
                                <p className="font-bold text-white text-lg leading-tight">
                                    {t("founderName")}
                                </p>
                                <p className="text-sm text-white/50 mt-0.5">
                                    {t("founderTitle")}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── Right: quote ── */}
                    <div className="flex flex-col justify-center gap-6 p-6 md:p-10 border-t md:border-t-0 md:border-l border-white/8">
                        {/* Large decorative quote mark */}
                        <span
                            className="text-8xl leading-none font-serif select-none"
                            style={{ color: "color-mix(in oklch, var(--color-primary) 30%, transparent)" }}
                            aria-hidden="true"
                        >
                            &ldquo;
                        </span>

                        {/* Quote body */}
                        <blockquote className="flex flex-col gap-6 -mt-6">
                            <p className="text-lg sm:text-xl text-white/75 leading-relaxed italic">
                                {t("quote")}
                            </p>

                            <ul className="flex flex-col gap-3">
                                {guaranteeBullets.map((item) => (
                                    <li key={item} className="flex items-start gap-2.5">
                                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                        <span className="text-white/65 text-sm leading-snug">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </blockquote>

                        {/* Divider + signature + CTA */}
                        <div className="flex flex-col gap-4 pt-4 border-t border-white/10">
                            <div className="flex items-center gap-4">
                                <div
                                    className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center text-sm font-bold text-white"
                                    style={{
                                        background:
                                            "linear-gradient(135deg, color-mix(in oklch, var(--color-primary) 60%, transparent), color-mix(in oklch, var(--color-primary) 20%, transparent))",
                                        border: "1px solid color-mix(in oklch, var(--color-primary) 40%, transparent)",
                                    }}
                                >
                                    DB
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{t("founderName")}</p>
                                    <p className="text-xs text-white/40">{t("founderTitle")}</p>
                                </div>
                            </div>
                            <a href="#pricing" className="button button--primary button--md w-fit">
                                {t("cta")}
                            </a>
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
}
