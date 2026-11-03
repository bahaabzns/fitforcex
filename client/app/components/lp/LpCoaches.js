import Image from "next/image";
import { useTranslations } from "next-intl";
import { LANDING_COACHES, LANDING_SECTIONS } from "@/lib/landingConfig";

// lucide-react doesn't ship brand icons, so Instagram is an inline glyph.
function InstagramIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
    );
}

export default function LpCoaches() {
    const t = useTranslations("lp.coaches");

    return (
        <section id={LANDING_SECTIONS.coaches} className="lp-section" style={{ scrollMarginTop: 90 }}>
            <div className="lp-glow lp-glow--soft" style={{ top: "10%", insetInlineStart: "-15%" }} aria-hidden="true" />
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                <ul className="lp-coaches">
                    {LANDING_COACHES.map((coach) => {
                        const copy = t.raw(coach.id);
                        return (
                            <li key={coach.id} className="lp-glass lp-coach">
                                <div className="lp-coach__photo">
                                    <Image src={coach.image} alt={copy.name} fill sizes="(min-width: 640px) 340px, 90vw" />
                                </div>
                                <div className="lp-coach__body">
                                    <h3>{copy.name}</h3>
                                    <p>{copy.description}</p>
                                    <a href={coach.instagramUrl} target="_blank" rel="noopener noreferrer" className="lp-coach__link">
                                        <InstagramIcon width={18} height={18} />
                                        <span dir="ltr">{coach.instagramHandle}</span>
                                        <span className="sr-only">{t("instagram")}</span>
                                    </a>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}
