import { useTranslations } from "next-intl";
import { FileInput, CirclePlay } from "lucide-react";

const ITEMS = [
    { key: "forms", Icon: FileInput },
    { key: "exercises", Icon: CirclePlay },
];

export default function LpBring() {
    const t = useTranslations("lp.bring");

    return (
        <section className="lp-section">
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>
                <ul className="lp-bring">
                    {ITEMS.map(({ key, Icon }) => (
                        <li key={key} className="lp-glass">
                            <Icon size={28} aria-hidden="true" />
                            <h3>{t(`${key}.title`)}</h3>
                            <p>{t(`${key}.body`)}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
