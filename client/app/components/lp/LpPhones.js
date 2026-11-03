'use client';

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { LANDING_PHONE_SCREENS, LANDING_SECTIONS } from "@/lib/landingConfig";
import { LpPhoneFrame } from "./LpFrames";
import LpShotImage from "./LpShotImage";

// What the client sees: three phones side by side on desktop, a swipe row with dots on phones.
export default function LpPhones() {
    const t = useTranslations("lp.phones");
    const screens = t.raw("screens");
    const bullets = t.raw("bullets");
    const rowRef = useRef(null);
    const [active, setActive] = useState(0);

    // The dot follows whichever phone is nearest the row's centre, in either text direction.
    function onScroll() {
        const row = rowRef.current;
        if (!row) return;
        const center = row.getBoundingClientRect().left + row.clientWidth / 2;
        let best = 0;
        let bestDistance = Infinity;
        [...row.children].forEach((child, index) => {
            const box = child.getBoundingClientRect();
            const distance = Math.abs(box.left + box.width / 2 - center);
            if (distance < bestDistance) { best = index; bestDistance = distance; }
        });
        setActive(best);
    }

    function goTo(index) {
        rowRef.current?.children[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }

    return (
        <section id={LANDING_SECTIONS.app} className="lp-section" style={{ scrollMarginTop: 90 }}>
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                <ul className="lp-phone-row" ref={rowRef} onScroll={onScroll}>
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

                <div className="lp-dots-row" role="group" aria-label={t("dots")}>
                    {LANDING_PHONE_SCREENS.map((id, index) => (
                        <button
                            key={id}
                            type="button"
                            className={`lp-dot ${active === index ? "is-active" : ""}`}
                            aria-label={screens[index].title}
                            aria-current={active === index}
                            onClick={() => goTo(index)}
                        />
                    ))}
                </div>

                <ul className="lp-list lp-list--inline">
                    {bullets.map((bullet) => (
                        <li key={bullet}><Check size={18} aria-hidden="true" />{bullet}</li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
