"use client";

import NextImage from "next/image";

/**
 * The logo shown to trainees: the coach's own when branding provides one, otherwise the
 * FitForce mark. Theme swap follows the existing `.brand-logo-light/.brand-logo-dark` rule
 * (globals.css). A coach with one logo gets it on both themes; with a dark variant, the dark
 * one is used on dark surfaces.
 */
export default function PortalLogo({ branding, width = 120, height = 32, className = "" }) {
    const logoUrl = branding?.logoUrl;
    const darkUrl = branding?.logoDarkUrl;
    const alt = branding?.name || "FitForce X";
    const style = { height, width: "auto", maxWidth: width * 1.5, objectFit: "contain" };

    if (!logoUrl) {
        return (
            <>
                <NextImage src="/blue_dark.png" alt="FitForce X" width={width} height={height}
                    className={`brand-logo-light shrink-0 ${className}`} style={{ height: "auto" }} priority />
                <NextImage src="/blue_white.png" alt="FitForce X" width={width} height={height}
                    className={`brand-logo-dark shrink-0 ${className}`} style={{ height: "auto" }} priority />
            </>
        );
    }

    if (!darkUrl) {
        // eslint-disable-next-line @next/next/no-img-element -- coach-uploaded, already resized server-side
        return <img src={logoUrl} alt={alt} style={style} className={`shrink-0 ${className}`} />;
    }

    return (
        <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={alt} style={style} className={`brand-logo-light shrink-0 ${className}`} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={darkUrl} alt={alt} style={style} className={`brand-logo-dark shrink-0 ${className}`} />
        </>
    );
}
