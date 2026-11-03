import { useTranslations } from "next-intl";
import { ChefHat, Smartphone, LineChart, ClipboardList, MessageCircle, Wallet } from "lucide-react";
import { LANDING_SECTIONS } from "@/lib/landingConfig";

// Order matches `lp.features.items` in the messages.
const ICONS = [ChefHat, Smartphone, LineChart, ClipboardList, MessageCircle, Wallet];

export default function LpFeatures() {
    const t = useTranslations("lp.features");
    const items = t.raw("items");

    return (
        <section id={LANDING_SECTIONS.features} className="lp-section" style={{ scrollMarginTop: 90 }}>
            <div className="lp-container lp-above">
                <div className="lp-head">
                    <h2 className="lp-h2">{t("title")}</h2>
                </div>
                <ul className="lp-grid lp-grid--3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {items.map((item, index) => {
                        const Icon = ICONS[index];
                        return (
                            <li key={item.title} className="lp-glass lp-card">
                                <span className="lp-icon-tile"><Icon size={24} strokeWidth={1.75} aria-hidden="true" /></span>
                                <h3>{item.title}</h3>
                                <p>{item.text}</p>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}
