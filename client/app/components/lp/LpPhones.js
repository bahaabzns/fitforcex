import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { LANDING_PHONE_SCREENS, LANDING_SECTIONS } from "@/lib/landingConfig";
import { LpPhoneFrame } from "./LpFrames";
import LpShotImage from "./LpShotImage";

// What the client sees: three phones side by side on desktop, a swipe row on phones.
export default function LpPhones() {
    const t = useTranslations("lp.phones");
    const screens = t.raw("screens");
    const bullets = t.raw("bullets");

    return (
        <section id={LANDING_SECTIONS.app} className="lp-section" style={{ scrollMarginTop: 90 }}>
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                <ul className="lp-phone-row">
                    {LANDING_PHONE_SCREENS.map((id, index) => (
                        <li key={id}>
                            <LpPhoneFrame>
                                <LpShotImage shotId={id} alt={screens[index].alt} />
                            </LpPhoneFrame>
                            <strong>{screens[index].title}</strong>
                            <span>{screens[index].text}</span>
                        </li>
                    ))}
                </ul>

                <ul className="lp-list lp-list--inline">
                    {bullets.map((bullet) => (
                        <li key={bullet}><Check size={18} aria-hidden="true" />{bullet}</li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
