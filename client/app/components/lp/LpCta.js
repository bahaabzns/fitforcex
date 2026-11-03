'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { WHATSAPP_URL } from "@/lib/landingConfig";

function WhatsAppIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m0 1.8a8.08 8.08 0 0 1 5.75 2.38 8.08 8.08 0 0 1 2.38 5.73c0 4.48-3.65 8.12-8.14 8.12a8.1 8.1 0 0 1-4.13-1.13l-.3-.17-3.12.82.83-3.04-.19-.31a8.06 8.06 0 0 1-1.24-4.32c0-4.48 3.65-8.08 8.15-8.08m-4.5 4.66c-.15 0-.4.06-.6.29-.21.23-.8.78-.8 1.9s.82 2.2.94 2.36c.11.15 1.6 2.5 3.95 3.4 1.94.76 2.34.6 2.76.57.42-.04 1.36-.55 1.55-1.09.19-.53.19-.99.13-1.09-.06-.09-.21-.15-.44-.27-.23-.11-1.36-.67-1.57-.75-.21-.08-.36-.11-.51.11-.15.23-.59.75-.72.9-.13.15-.27.17-.5.06-.23-.11-.96-.35-1.83-1.13-.68-.6-1.13-1.34-1.27-1.57-.13-.23-.01-.35.1-.47.11-.11.23-.27.35-.4.11-.14.15-.23.23-.38.08-.15.04-.29-.02-.4-.06-.11-.51-1.25-.71-1.71-.19-.45-.38-.39-.51-.39z" />
        </svg>
    );
}

export function LpFinalCta({ dashboardUrl }) {
    const t = useTranslations("lp.cta");
    const tNav = useTranslations("lp.nav");

    return (
        <section className="lp-section" style={{ paddingTop: 0 }}>
            <div className="lp-container lp-above">
                <div className="lp-glass lp-glass--blue lp-cta">
                    <h2>{t("title")}</h2>
                    <p className="lp-lead" style={{ maxWidth: "34rem" }}>{t("subtitle")}</p>
                    <div className="lp-cta__actions">
                        <Link href={dashboardUrl || "/register"} className="lp-btn lp-btn--primary lp-btn--lg">
                            {dashboardUrl ? tNav("dashboard") : t("start")}
                        </Link>
                        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn--wa lp-btn--lg">
                            <WhatsAppIcon width={20} height={20} />
                            {t("whatsapp")}
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}

export function LpFooter() {
    const t = useTranslations("lp.footer");
    const links = [
        { href: "/about", label: t("about") },
        { href: "/contact", label: t("contact") },
        { href: "/privacy", label: t("privacy") },
        { href: "/refund-policy", label: t("refund") },
        { href: "/delivery-policy", label: t("delivery") },
    ];

    return (
        <footer className="lp-footer">
            <div className="lp-container">
                <div className="lp-footer__row">
                    <Image src="/blue_white.png" alt="FitForce" width={120} height={32} style={{ height: 28, width: "auto" }} />
                    <nav className="lp-footer__links" aria-label="Footer">
                        {links.map(({ href, label }) => <Link key={href} href={href}>{label}</Link>)}
                    </nav>
                    <p>{t("rights", { year: new Date().getFullYear() })}</p>
                </div>
            </div>
        </footer>
    );
}

// Desktop: floating button. Phones: sticky bar with the primary action next to WhatsApp.
export function LpFloating({ dashboardUrl }) {
    const t = useTranslations("lp.bar");
    const tNav = useTranslations("lp.nav");
    // Starts visible so the bar still works if the hero button is missing (e.g. logged-in view).
    const [showBar, setShowBar] = useState(true);

    // The phone bar only appears once the hero button has scrolled out of view.
    useEffect(() => {
        const heroButton = document.getElementById("lp-hero-cta");
        if (!heroButton) return undefined;
        const observer = new IntersectionObserver(([entry]) => setShowBar(!entry.isIntersecting));
        observer.observe(heroButton);
        return () => observer.disconnect();
    }, []);

    return (
        <>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="lp-wa-float" aria-label={t("whatsapp")}>
                <WhatsAppIcon width={26} height={26} />
            </a>
            <div className={`lp-bar ${showBar ? "is-visible" : ""}`}>
                <Link href={dashboardUrl || "/register"} className="lp-btn lp-btn--primary">
                    {dashboardUrl ? tNav("dashboard") : t("start")}
                </Link>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn--wa">
                    <WhatsAppIcon width={20} height={20} />
                    {t("whatsapp")}
                </a>
            </div>
        </>
    );
}
