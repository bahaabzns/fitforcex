import { useLocale, useTranslations } from "next-intl";
import { assetUrl } from "@/lib/landingConfig";
import { FileInput, CirclePlay } from "lucide-react";

const ITEMS = [
    { key: "forms", Icon: FileInput },
    { key: "exercises", Icon: CirclePlay },
];

export default function LpBring() {
    const t = useTranslations("lp.bring");
    const locale = useLocale();

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
                            <div className="lp-bring__shot">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={assetUrl(`/lp/${locale}-bring-${key}.webp`)}
                                    srcSet={`${assetUrl(`/lp/${locale}-bring-${key}-m.webp`)} 560w, ${assetUrl(`/lp/${locale}-bring-${key}.webp`)} 1008w`}
                                    sizes="(min-width: 720px) 480px, 100vw"
                                    alt={t(`${key}.title`)}
                                    loading="lazy"
                                    decoding="async"
                                />
                            </div>
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
