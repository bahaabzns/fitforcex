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

// The "before" as a chat scramble and the "after" as one clean client record: an illustration,
// labelled as such, not a screenshot of real data.
function Illustration({ t }) {
    const sample = [
        { label: t("plan"), state: t("planState"), tone: "sent" },
        { label: t("checkin"), state: t("checkinState"), tone: "due" },
        { label: t("pay"), state: t("payState"), tone: "paid" },
    ];
    return (
        <div className="lp-vs" role="img" aria-label={`${t("chat")} → ${t("clientName")}`}>
            <div className="lp-glass lp-vs__before" aria-hidden="true">
                <span className="lp-vs__tag">{t("sample")}</span>
                <p className="lp-vs__bubble">{t("chat")}<small>{t("chatTime")}</small></p>
                <p className="lp-vs__file"><FileText size={18} />{t("pdf")}</p>
                <p className="lp-vs__bubble">{t("payq")}</p>
            </div>

            <ArrowRight className="lp-vs__arrow" size={28} aria-hidden="true" />

            <div className="lp-glass lp-glass--blue lp-vs__after" aria-hidden="true">
                <span className="lp-vs__tag">{t("sample")}</span>
                <div className="lp-vs__client">
                    <span className="lp-vs__avatar">{t("clientName").charAt(0)}</span>
                    <strong>{t("clientName")}</strong>
                </div>
                <ul>
                    {sample.map(({ label, state, tone }) => (
                        <li key={label}>
                            <span>{label}</span>
                            <em className={`lp-pill lp-pill--${tone}`}>{state}</em>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default function LpProblem() {
    const t = useTranslations("lp.problem");
    const tVisual = useTranslations("lp.problem.visual");
    const without = t.raw("without");
    const withFitForce = t.raw("with");

    return (
        <section className="lp-section">
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center" style={{ maxWidth: 980 }}>
                    <h2 className="lp-h2" style={{ fontSize: "clamp(1.9rem, 2.4vw + 0.6rem, 2.5rem)" }}>{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                <Illustration t={tVisual} />

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
