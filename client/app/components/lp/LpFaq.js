import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { LANDING_SECTIONS } from "@/lib/landingConfig";

// Answers still waiting for real copy are written as [bracketed] text and shown in amber.
function Answer({ text }) {
    return text.split(/(\[[^\]]+\])/).map((part, index) => (
        part.startsWith("[") ? <span key={index} className="lp-placeholder">{part}</span> : part
    ));
}

export default function LpFaq() {
    const t = useTranslations("lp.faq");
    const items = t.raw("items");
    const half = Math.ceil(items.length / 2);

    return (
        <section id={LANDING_SECTIONS.faq} className="lp-section" style={{ scrollMarginTop: 90 }}>
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2">{t("title")}</h2>
                </div>
                <div className="lp-faq">
                    {[items.slice(0, half), items.slice(half)].map((column, columnIndex) => (
                        <div key={columnIndex} className="lp-faq__col">
                            {column.map(({ q, a }, index) => (
                                <details key={q} className="lp-glass" open={columnIndex === 0 && index === 0}>
                                    <summary>
                                        {q}
                                        <ChevronDown size={22} aria-hidden="true" />
                                    </summary>
                                    <p><Answer text={a} /></p>
                                </details>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
