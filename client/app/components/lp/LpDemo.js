'use client';

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Play } from "lucide-react";
import { DEMO_VIDEO_ID, LANDING_SECTIONS } from "@/lib/landingConfig";

// Click-to-play facade: the YouTube player's scripts only load once a visitor presses play,
// and that press is the interaction that lets it start straight away.
export default function LpDemo() {
    const t = useTranslations("lp.demo");
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <section id={LANDING_SECTIONS.demo} className="lp-section" style={{ scrollMarginTop: 90, paddingBlock: "clamp(40px, 6vw, 80px)" }}>
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center" style={{ marginBottom: "clamp(28px, 4vw, 48px)" }}>
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                <div className="lp-glass lp-frame" style={{ maxWidth: 960, marginInline: "auto" }}>
                    <div className="lp-demo">
                        {isPlaying ? (
                            <iframe
                                src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?rel=0&autoplay=1`}
                                title={t("videoTitle")}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <button type="button" className="lp-demo__play" onClick={() => setIsPlaying(true)} aria-label={t("play")}>
                                <Image src="/lp/demo-poster.webp" alt="" fill sizes="(min-width: 1000px) 960px, 100vw" />
                                <span className="lp-demo__icon" aria-hidden="true"><Play size={30} fill="currentColor" strokeWidth={0} /></span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
