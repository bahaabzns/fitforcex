import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";

export default function LpProblem() {
    const t = useTranslations("lp.problem");
    const without = t.raw("without");
    const withFitForce = t.raw("with");

    return (
        <section className="lp-section">
            <div className="lp-container lp-above">
                <div className="lp-head">
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                <div className="lp-problem">
                    <div className="lp-glass lp-panel">
                        <h3>{t("withoutTitle")}</h3>
                        <ul className="lp-list lp-list--bad">
                            {without.map((item) => (
                                <li key={item}><X size={18} aria-hidden="true" />{item}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="lp-glass lp-glass--blue lp-panel">
                        <h3>{t("withTitle")}</h3>
                        <ul className="lp-list lp-list--good">
                            {withFitForce.map((item) => (
                                <li key={item}><Check size={18} aria-hidden="true" />{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}
