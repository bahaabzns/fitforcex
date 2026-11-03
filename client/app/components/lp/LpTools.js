'use client';

import { useTranslations } from "next-intl";
import { LANDING_TOOLS } from "@/lib/landingConfig";
import LpZoomImage from "./LpZoomImage";

// Bento grid: glass cards in a planned layout (wide, tall and small), each a zoomed crop of the
// relevant screen with a short title. The grid areas live in landing.css as .lp-tool--<id>.
export default function LpTools() {
    const t = useTranslations("lp.tools");
    const items = t.raw("items");

    return (
        <section className="lp-section">
            <div className="lp-glow lp-glow--soft" style={{ top: "20%", insetInlineEnd: "-20%" }} aria-hidden="true" />
            <div className="lp-container lp-above">
                <div className="lp-head">
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                <ul className="lp-bento">
                    {LANDING_TOOLS.map((id, index) => (
                        <li key={id} className={`lp-glass lp-tool lp-tool--${id}`}>
                            <LpZoomImage shotId={id} alt={`${items[index].title}. ${items[index].text}`} view="tool" markerLimit={1} />
                            <div className="lp-tool__title">
                                <strong>{items[index].title}</strong>
                                <span>{items[index].text}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
