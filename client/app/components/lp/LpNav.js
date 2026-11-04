'use client';

import { useEffect, useRef, useState } from "react";
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
    const firstLinkRef = useRef(null);

    // Bottom sheet behaviour: Escape closes it, the page behind does not scroll, focus moves into it.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", onKey);
        firstLinkRef.current?.focus();
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

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
                <>
                    <div className="lp-sheet-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
                    <div className="lp-sheet" role="dialog" aria-modal="true" aria-label={t("menu")}>
                        <span className="lp-sheet__grab" aria-hidden="true" />
                        <nav className="lp-sheet__links" aria-label="Main">
                            {links.map(({ id, label }, index) => (
                                <a key={id} href={`#${id}`} ref={index === 0 ? firstLinkRef : undefined} onClick={() => setOpen(false)}>{label}</a>
                            ))}
                            {!dashboardUrl && <Link href="/login" onClick={() => setOpen(false)}>{t("login")}</Link>}
                        </nav>
                        <Link href={dashboardUrl || "/register"} className="lp-btn lp-btn--primary lp-btn--full lp-btn--lg" onClick={() => setOpen(false)}>
                            {dashboardUrl ? t("dashboard") : t("start")}
                        </Link>
                    </div>
                </>
            )}
        </>
    );
}
