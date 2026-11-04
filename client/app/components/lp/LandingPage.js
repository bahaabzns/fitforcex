'use client';

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { trackPixelEvent } from "@/lib/metaPixel";
import LpNav from "./LpNav";
import LpHero from "./LpHero";
import LpStats from "./LpStats";
import LpLightbox from "./LpLightbox";
import LpProblem from "./LpProblem";
import LpDay from "./LpDay";
import LpBring from "./LpBring";
import LpAppDemo from "./LpAppDemo";
import LpCoaches from "./LpCoaches";
import LpPricing from "./LpPricing";
import LpFaq from "./LpFaq";
import { LpFinalCta, LpFooter, LpFloating } from "./LpCta";

// Standard Meta events only, decided from the clicked element so sections stay free of tracking code.
function pixelEventFor(element) {
    if (element.closest("[data-pixel]")) return { name: element.closest("[data-pixel]").dataset.pixel };
    const link = element.closest("a[href]");
    if (!link) return null;
    const href = link.getAttribute("href");
    if (href.includes("wa.me")) return { name: "Contact" };
    if (href.startsWith("/register")) {
        const plan = new URLSearchParams(href.split("?")[1] || "").get("plan");
        return plan ? { name: "InitiateCheckout", params: { content_name: plan } } : { name: "Lead" };
    }
    return null;
}

// Any product screenshot opens full screen on click; small phone copies swap to the full-size file.
const ZOOMABLE_IMAGE = ".lp-zoom img, .lp-frame img, .lp-bring__shot img";

export default function LandingPage() {
    const tUi = useTranslations("lp.ui");
    const [user, setUser] = useState(null);
    const [zoomed, setZoomed] = useState(null);

    // Identity is non-blocking: the page renders for everyone straight away, and only the
    // calls to action swap to "Go to dashboard" once a session is confirmed.
    useEffect(() => {
        api.get('/api/auth/me')
            .then((response) => setUser(response.data))
            .catch(() => setUser(null));
    }, []);

    const dashboardUrl = user?.currentWorkspace?.slug ? `/${user.currentWorkspace.slug}/dashboard` : null;

    return (
        <main className="lp" onClick={(event) => {
            const pixelEvent = pixelEventFor(event.target);
            if (pixelEvent) trackPixelEvent(pixelEvent.name, pixelEvent.params);
            const image = event.target.closest?.(ZOOMABLE_IMAGE);
            if (image) setZoomed({ src: image.currentSrc.replace("-m.webp", ".webp"), alt: image.alt });
        }}>
            <LpNav dashboardUrl={dashboardUrl} />
            <LpHero dashboardUrl={dashboardUrl} />
            <LpStats />
            <LpProblem />
            <LpDay />
            <LpAppDemo />
            <LpBring />
            <LpCoaches />
            <LpPricing />
            <LpFaq />
            <LpFinalCta dashboardUrl={dashboardUrl} />
            <LpFooter />
            <LpFloating dashboardUrl={dashboardUrl} />
            <LpLightbox image={zoomed} closeLabel={tUi("close")} onClose={() => setZoomed(null)} />
        </main>
    );
}
