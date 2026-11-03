import { getTranslations } from "next-intl/server";
import LandingPage from "./components/lp/LandingPage";
import "./landing.css";

export async function generateMetadata() {
    const t = await getTranslations("lp.meta");
    return {
        title: t("title"),
        description: t("description"),
        openGraph: { title: t("title"), description: t("description"), type: "website", images: ["/icon-512.png"] },
        twitter: { card: "summary", title: t("title"), description: t("description") },
    };
}

export default function HomePage() {
    return <LandingPage />;
}
