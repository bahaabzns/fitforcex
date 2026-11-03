import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { LANDING_SECTIONS } from "@/lib/landingConfig";

export default function LpFaq() {
    const t = useTranslations("lp.faq");
    const items = t.raw("items");

    return (
        <section id={LANDING_SECTIONS.faq} className="lp-section" style={{ scrollMarginTop: 90 }}>
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2">{t("title")}</h2>
                </div>
                <div className="lp-faq">
                    {items.map(({ q, a }, index) => (
                        <details key={q} className="lp-glass" open={index === 0}>
                            <summary>
                                {q}
                                <ChevronDown size={22} aria-hidden="true" />
                            </summary>
                            <p>{a}</p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
