import { getLocale, getTranslations } from "next-intl/server";
import LandingPage from "./components/lp/LandingPage";
import "./landing.css";

export async function generateMetadata() {
    const locale = await getLocale();
    const t = await getTranslations("lp.meta");
    const ogImage = { url: `/og-${locale === "ar" ? "ar" : "en"}.png`, width: 1200, height: 630, alt: t("title") };
    // Set NEXT_PUBLIC_SITE_URL (e.g. https://fitforce.io) in production so the canonical link and share images get absolute URLs.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    return {
        ...(siteUrl ? { metadataBase: new URL(siteUrl), alternates: { canonical: "/" } } : {}),
        title: t("title"),
        description: t("description"),
        openGraph: { title: t("title"), description: t("description"), type: "website", locale: locale === "ar" ? "ar_EG" : "en_US", images: [ogImage] },
        twitter: { card: "summary_large_image", title: t("title"), description: t("description"), images: [ogImage.url] },
    };
}

// Answers still written as [placeholders] are not published to search engines.
const PLACEHOLDER_ANSWER = /\[[^\]]+\]/;

export default async function HomePage() {
    const t = await getTranslations("lp.faq");
    const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: t.raw("items")
            .filter(({ a }) => !PLACEHOLDER_ANSWER.test(a))
            .map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\u003c") }} />
            <LandingPage />
        </>
    );
}
