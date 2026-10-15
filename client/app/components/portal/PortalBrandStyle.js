"use client";

import { useEffect, useMemo } from "react";
import { buildBrandCss } from "@/lib/brandTheme";
import { setDocumentBrand } from "@/hooks/usePageTitle";

/**
 * Applies a coach's branding to the whole page: theme variables (via a validated-hex-only
 * stylesheet) and the browser-tab brand name. Renders nothing visible. Falls back to the
 * default FitForce theme when `branding` is null or has no primary color.
 *
 * Branding comes from the server already resolved against the coach's plan and subscription,
 * so a null `brandColor` always means "use the default".
 */
export default function PortalBrandStyle({ branding }) {
    const css = useMemo(
        () => buildBrandCss({ primaryColor: branding?.brandColor, accentColor: branding?.accentColor }),
        [branding?.brandColor, branding?.accentColor],
    );

    useEffect(() => {
        setDocumentBrand(branding?.name);
        return () => setDocumentBrand(null);
    }, [branding?.name]);

    if (!css) return null;
    // css is built only from regex-validated #RRGGBB values (see lib/brandTheme.js).
    return <style data-portal-brand dangerouslySetInnerHTML={{ __html: css }} />;
}
