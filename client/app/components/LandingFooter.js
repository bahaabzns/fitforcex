'use client';

import Link from "next/link";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

const WHATSAPP_URL = "https://wa.me/201017979636?text=Hello!%20I'm%20interested%20in%20FitForce.";

// lucide-react doesn't ship brand/social icons — inline glyphs instead.
function TwitterIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M18.36 2H21.5l-7.5 8.57L22.8 22h-6.9l-5.4-7.06L4.3 22H1.15l8.03-9.17L1.5 2h7.08l4.88 6.45L18.36 2zm-1.21 18.2h1.9L7.94 3.7H5.9l11.25 16.5z" />
        </svg>
    );
}
function FacebookIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.16 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.78 8.44-4.94 8.44-9.94z" />
        </svg>
    );
}
function InstagramIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
    );
}

export default function LandingFooter({ dashboardUrl }) {
    const t = useTranslations("landing.footer");

    const productLinks = [
        { label: t("features"), href: "#features" },
        { label: t("pricing"), href: "#pricing" },
        ...(dashboardUrl
            ? [{ label: t("dashboard"), href: dashboardUrl }]
            : [
                { label: t("clientPortal"), href: "/login" },
                { label: t("startTrial"), href: "/register" },
            ]
        ),
    ];

    const companyLinks = [
        { label: t("about"), href: "#" },
        { label: t("blog"), href: "#" },
        { label: t("careers"), href: "#" },
    ];

    const supportLinks = [
        { label: t("helpCenter"), href: "#" },
        { label: t("contact"), href: WHATSAPP_URL },
    ];

    const legalLinks = [
        { label: t("privacy"), href: "/privacy" },
        { label: t("terms"), href: "#" },
        { label: t("cookiePolicy"), href: "#" },
    ];

    return (
        <footer className="border-t border-white/10 bg-[#080d1a]">

            {/* ── Pre-footer CTA banner ── */}
            <div className="border-b border-white/8 px-8 py-12 md:py-16 text-center flex flex-col items-center gap-5">
                <h2 className="text-2xl md:text-3xl font-black text-white">{t("ctaTitle")}</h2>
                <p className="text-white/50 max-w-lg">{t("ctaSubtitle")}</p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/register" className="button button--primary button--lg">
                        {t("startTrial")}
                    </Link>
                    <a
                        href={WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button button--secondary button--lg"
                    >
                        {t("talkToSales")}
                    </a>
                </div>
                <p className="text-xs text-white/30">{t("guarantees")}</p>
            </div>

            {/* Top row — logo + link columns */}
            <div className="mx-auto max-w-7xl px-8 py-10 md:py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-10">

                {/* Brand */}
                <div className="flex flex-col gap-4 lg:col-span-2">
                    <span className="text-xl font-bold tracking-tight text-white">
                        FitForce
                    </span>
                    <p className="text-sm text-white/40 leading-relaxed max-w-xs">
                        {t("tagline")}
                    </p>
                    <LanguageSwitcher />
                </div>

                {/* Product links */}
                <div className="flex flex-col gap-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
                        {t("product")}
                    </p>
                    <nav className="flex flex-col gap-3">
                        {productLinks.map(({ label, href }) => (
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
                        {t("company")}
                    </p>
                    <nav className="flex flex-col gap-3">
                        {companyLinks.map(({ label, href }) => (
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

                {/* Support links */}
                <div className="flex flex-col gap-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
                        {t("support")}
                    </p>
                    <nav className="flex flex-col gap-3">
                        {supportLinks.map(({ label, href }) => (
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
                        {t("legal")}
                    </p>
                    <nav className="flex flex-col gap-3">
                        {legalLinks.map(({ label, href }) => (
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

            {/* Bottom row — copyright + email + social */}
            <div className="border-t border-white/8 py-6 px-8">
                <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-white/25">
                        {t("copyright", { year: new Date().getFullYear() })}
                    </p>
                    <div className="flex items-center gap-5">
                        <a href={`mailto:${t("email")}`} className="text-xs text-white/40 hover:text-white transition-colors">
                            {t("email")}
                        </a>
                        <div className="flex items-center gap-3">
                            <a href="#" aria-label="Twitter" className="text-white/40 hover:text-primary transition-colors">
                                <TwitterIcon className="h-4 w-4" />
                            </a>
                            <a href="#" aria-label="Facebook" className="text-white/40 hover:text-primary transition-colors">
                                <FacebookIcon className="h-4 w-4" />
                            </a>
                            <a href="#" aria-label="Instagram" className="text-white/40 hover:text-primary transition-colors">
                                <InstagramIcon className="h-4 w-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
