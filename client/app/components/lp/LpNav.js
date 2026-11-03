'use client';

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { LANDING_SECTIONS, setLocaleCookie } from "@/lib/landingConfig";

const LOCALES = [
    { code: "en", label: "EN" },
    { code: "ar", label: "ع" },
];

function LanguageSwitch() {
    const locale = useLocale();
    const router = useRouter();

    function choose(code) {
        if (code === locale) return;
        setLocaleCookie(code);
        router.refresh();
    }

    return (
        <div className="lp-lang" role="group" aria-label="Language">
            {LOCALES.map(({ code, label }) => (
                <button key={code} type="button" aria-pressed={locale === code} lang={code} onClick={() => choose(code)}>
                    {label}
                </button>
            ))}
        </div>
    );
}

export default function LpNav({ dashboardUrl }) {
    const t = useTranslations("lp.nav");
    const [open, setOpen] = useState(false);

    const links = [
        { id: LANDING_SECTIONS.day, label: t("day") },
        { id: LANDING_SECTIONS.app, label: t("app") },
        { id: LANDING_SECTIONS.pricing, label: t("pricing") },
        { id: LANDING_SECTIONS.faq, label: t("faq") },
    ];

    return (
        <>
            <nav className="lp-nav lp-glass" aria-label="Main">
                <Link href="/" aria-label="FitForce" className="flex items-center">
                    <Image src="/blue_white.png" alt="FitForce" width={120} height={32} priority style={{ height: 30, width: "auto" }} />
                </Link>

                <div className="lp-nav__links">
                    {links.map(({ id, label }) => (
                        <a key={id} href={`#${id}`} className="lp-nav__link">{label}</a>
                    ))}
                </div>

                <div className="lp-nav__end">
                    <LanguageSwitch />
                    {!dashboardUrl && (
                        <Link href="/login" className="lp-nav__link lp-nav__login">{t("login")}</Link>
                    )}
                    <Link href={dashboardUrl || "/register"} className="lp-btn lp-btn--primary">
                        {dashboardUrl ? t("dashboard") : t("start")}
                    </Link>
                    <button
                        type="button"
                        className="lp-menu-btn"
                        aria-expanded={open}
                        aria-label={open ? t("close") : t("menu")}
                        onClick={() => setOpen((v) => !v)}
                    >
                        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
                    </button>
                </div>
            </nav>

            {open && (
                <div className="lp-mobile-menu lp-glass">
                    {links.map(({ id, label }) => (
                        <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>{label}</a>
                    ))}
                    {!dashboardUrl && <Link href="/login" onClick={() => setOpen(false)}>{t("login")}</Link>}
                </div>
            )}
        </>
    );
}
