'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { Chip } from "@heroui/react/chip";
import api from "@/lib/axios";
import LandingNav from "./components/LandingNav";
import LandingHeroCarousel from "./components/LandingHeroCarousel";
import LandingFeatures from "./components/LandingFeatures";
import LandingTestimonials from "./components/LandingTestimonials";
import LandingPricing from "./components/LandingPricing";
import LandingFounder from "./components/LandingFounder";
import LandingFaq from "./components/LandingFaq";
import LandingCta from "./components/LandingCta";

export default function HomePage() {
    const [checking, setChecking] = useState(true);
    const [user, setUser] = useState(null);

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
            <div className="dark min-h-screen bg-[#080d1a] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    const dashboardUrl = user?.currentWorkspace?.slug ? `/${user.currentWorkspace.slug}/dashboard` : null;

    return (
        <main className="dark min-h-screen bg-[#080d1a] text-white flex flex-col">

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
                    Built for Fitness Coaches
                </Chip>

                {/* Heading */}
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] max-w-4xl text-white">
                    One System to Run Your{" "}
                    <span className="text-primary">Coaching Business</span>
                </h1>

                {/* Subtitle */}
                <p className="text-lg text-white/55 max-w-2xl leading-relaxed">
                    Manage unlimited clients, deliver custom workout and nutrition plans,
                    and grow your coaching business—all in one place.
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
                                Get Started – It&apos;s FREE!
                            </Link>
                            <p className="text-white/55 text-sm">✓ No credit card needed, cancel any time</p>
                        </>
                    )}
                </div>

                {/* Feature carousel */}
                <LandingHeroCarousel />
            </section>

            {/* ── Trust banner ── */}
            <section className="mt-8 sm:mt-16 py-5 border-y border-white/8 bg-white/2">
                <p className="text-center text-white/55 text-sm sm:text-base font-medium px-4">
                    Build plans, manage clients, and track progress —{" "}
                    <span className="text-white/85">everything in one place.</span>
                </p>
            </section>

            {/* ── Features (Phase 3) ── */}
            <LandingFeatures />

            {/* ── Testimonials (Phase 6) ── */}
            <LandingTestimonials />

            {/* ── Pricing (Phase 4) ── */}
            <LandingPricing />

            {/* ── Founder's Guarantee (Phase 7) ── */}
            <LandingFounder />

            {/* ── FAQ (Phase 5) ── */}
            <LandingFaq />

            {/* ── Final CTA (Phase 8) ── */}
            <LandingCta />

            {/* ── Footer (Phase 9) ── */}
            <footer className="border-t border-white/10 bg-[#080d1a]">
                {/* Top row — logo + link columns */}
                <div className="mx-auto max-w-7xl px-8 py-10 md:py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

                    {/* Brand */}
                    <div className="flex flex-col gap-4 lg:col-span-1">
                        <span className="text-xl font-bold tracking-tight text-white">
                            FitForce
                        </span>
                        <p className="text-sm text-white/40 leading-relaxed max-w-xs">
                            The all-in-one coaching platform for serious fitness professionals.
                        </p>
                    </div>

                    {/* Product links */}
                    <div className="flex flex-col gap-4">
                        <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
                            Product
                        </p>
                        <nav className="flex flex-col gap-3">
                            {[
                                { label: "Features", href: "#features" },
                                { label: "Pricing", href: "#pricing" },
                                ...(dashboardUrl
                                    ? [{ label: "Dashboard", href: dashboardUrl }]
                                    : [
                                        { label: "Client Portal", href: "/login" },
                                        { label: "Get Started", href: "/register" },
                                    ]
                                ),
                            ].map(({ label, href }) => (
                                <a
                                    key={label}
                                    href={href}
                                    className="text-sm text-white/45 hover:text-white transition-colors"
                                >
                                    {label}
                                </a>
                            ))}
                        </nav>
                    </div>

                    {/* Company links */}
                    <div className="flex flex-col gap-4">
                        <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
                            Company
                        </p>
                        <nav className="flex flex-col gap-3">
                            {[
                                { label: "About", href: "#about" },
                                { label: "Blog", href: "#" },
                                { label: "Careers", href: "#" },
                                { label: "Contact", href: "#" },
                            ].map(({ label, href }) => (
                                <a
                                    key={label}
                                    href={href}
                                    className="text-sm text-white/45 hover:text-white transition-colors"
                                >
                                    {label}
                                </a>
                            ))}
                        </nav>
                    </div>

                    {/* Legal links */}
                    <div className="flex flex-col gap-4">
                        <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
                            Legal
                        </p>
                        <nav className="flex flex-col gap-3">
                            {[
                                { label: "Privacy Policy", href: "/privacy" },
                                { label: "Terms of Service", href: "#" },
                                { label: "Cookie Policy", href: "#" },
                            ].map(({ label, href }) => (
                                <a
                                    key={label}
                                    href={href}
                                    className="text-sm text-white/45 hover:text-white transition-colors"
                                >
                                    {label}
                                </a>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Bottom row — copyright */}
                <div className="border-t border-white/8 py-6 px-8">
                    <p className="text-center text-xs text-white/25">
                        © {new Date().getFullYear()} FitForce. All rights reserved.
                    </p>
                </div>
            </footer>
        </main>
    );
}
