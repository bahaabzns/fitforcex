import { useTranslations } from "next-intl";
import {
    ArrowRight, CalendarClock, ChevronDown, FileSpreadsheet, FileText, LineChart,
    MessageCircle, Smartphone, Users, Wallet,
} from "lucide-react";
import { LANDING_SECTIONS } from "@/lib/landingConfig";

// Icons for each before/after pair, in the same order as `lp.problem.without` / `lp.problem.with`.
const ROW_ICONS = [
    [FileText, Smartphone],
    [MessageCircle, LineChart],
    [FileSpreadsheet, Wallet],
    [CalendarClock, Users],
];

export default function LpProblem() {
    const t = useTranslations("lp.problem");
    const without = t.raw("without");
    const withFitForce = t.raw("with");

    return (
        <section className="lp-section">
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center" style={{ maxWidth: 980 }}>
                    <h2 className="lp-h2" style={{ fontSize: "clamp(1.9rem, 2.4vw + 0.6rem, 2.5rem)" }}>{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                <div className="lp-rows">
                    <div className="lp-rows__labels" aria-hidden="true">
                        <span>{t("withoutTitle")}</span>
                        <span />
                        <span className="is-after">{t("withTitle")}</span>
                    </div>
                    <ul>
                        {without.map((before, index) => {
                            const [BeforeIcon, AfterIcon] = ROW_ICONS[index];
                            return (
                                <li key={before} className="lp-row">
                                    <div className="lp-row__before">
                                        <BeforeIcon size={22} aria-hidden="true" />
                                        <p><span className="sr-only">{t("withoutTitle")}: </span>{before}</p>
                                    </div>
                                    <ArrowRight className="lp-row__arrow" size={22} aria-hidden="true" />
                                    <div className="lp-row__after">
                                        <AfterIcon size={22} aria-hidden="true" />
                                        <p><span className="sr-only">{t("withTitle")}: </span>{withFitForce[index]}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <a href={`#${LANDING_SECTIONS.day}`} className="lp-closing">
                    {t("closing")}
                    <ChevronDown size={18} aria-hidden="true" />
                </a>
            </div>
        </section>
    );
}
