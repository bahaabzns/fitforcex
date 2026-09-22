'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { Chip } from "@heroui/react/chip";
import api from "@/lib/axios";
import LandingNav from "./components/LandingNav";
import LandingHeroCarousel from "./components/LandingHeroCarousel";
import LandingFeatures from "./components/LandingFeatures";
import LandingTestimonials from "./components/LandingTestimonials";
import LandingPricing from "./components/LandingPricing";
import LandingFounder from "./components/LandingFounder";
import LandingFaq from "./components/LandingFaq";
import LandingFooter from "./components/LandingFooter";
import LandingScrollToTop from "./components/LandingScrollToTop";
import LandingWhatsAppButton from "./components/LandingWhatsAppButton";

const ibmPlexSans = IBM_Plex_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-landing-sans",
});
const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
    subsets: ["arabic"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-landing-arabic",
});

export default function HomePage() {
    const [checking, setChecking] = useState(true);
    const [user, setUser] = useState(null);
    const t = useTranslations("landing.hero");

    useEffect(() => {
        api.get('/api/auth/me')
            .then(res => {
                setUser(res.data);
            })
            .catch(() => {
                setUser(null);
            })
            .finally(() => {
                setChecking(false);
            });
    }, []);

    if (checking) {
        return (
            <div className={`dark min-h-screen bg-[#080d1a] flex items-center justify-center font-landing ${ibmPlexSans.variable} ${ibmPlexSansArabic.variable}`}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    const dashboardUrl = user?.currentWorkspace?.slug ? `/${user.currentWorkspace.slug}/dashboard` : null;

    return (
        <main className={`dark min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#080d1a] text-white flex flex-col font-landing ${ibmPlexSans.variable} ${ibmPlexSansArabic.variable}`}>

            {/* ── Nav ── */}
            <LandingNav user={user} dashboardUrl={dashboardUrl} />

            {/* ── Hero ── */}
            <section className="relative flex flex-col items-center text-center px-6 pt-20 pb-0 gap-8 overflow-hidden">

                {/* Radial glow behind heading */}
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-125"
                    style={{
                        background:
                            "radial-gradient(ellipse 70% 50% at 50% 0%, color-mix(in oklch, var(--color-primary) 18%, transparent), transparent)",
                    }}
                />

                {/* Badge */}
                <Chip color="accent" size="md">
                    {t("badge")}
                </Chip>

                {/* Heading */}
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] max-w-4xl text-white">
                    {t("titleLine1")}{" "}
                    <span className="text-primary">{t("titleHighlight")}</span>
                </h1>

                {/* Subtitle */}
                <p className="text-lg text-white/55 max-w-2xl leading-relaxed">
                    {t("subtitle")}
                </p>

                {/* CTA */}
                <div className="flex flex-col items-center gap-2">
                    {dashboardUrl ? (
                        <Link href={dashboardUrl} className="button button--primary button--lg">
                            Go to Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link href="/register" className="button button--primary button--lg">
                                {t("cta")}
                            </Link>
                            <p className="text-white/55 text-sm">✓ {t("noCreditCard")}</p>
                        </>
                    )}
                </div>

                {/* Modules Slider */}
                <LandingHeroCarousel />
            </section>

            {/* ── Trust banner ── */}
            <section className="mt-8 sm:mt-16 py-5 border-y border-white/8 bg-white/2">
                <p className="text-center text-white/55 text-sm sm:text-base font-medium px-4">
                    Build plans, manage clients, and track progress —{" "}
                    <span className="text-white/85">everything in one place.</span>
                </p>
            </section>

            {/* ── Feature Cards ── */}
            <LandingFeatures />

            {/* ── Trusted By (coach carousel) ── */}
            <LandingTestimonials />

            {/* ── Choose Your Plan ── */}
            <LandingPricing />

            {/* ── Founder's Guarantee ── */}
            <LandingFounder />

            {/* ── FAQ ── */}
            <LandingFaq />

            {/* ── Footer ── */}
            <LandingFooter dashboardUrl={dashboardUrl} />

            {/* ── Floating buttons ── */}
            <LandingScrollToTop />
            <LandingWhatsAppButton />
        </main>
    );
}
