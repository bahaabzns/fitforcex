'use client';

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Play } from "lucide-react";

// Landing-page hero video: the general "How to use FitForce" walkthrough, embedded
// from YouTube. Shown as a click-to-play thumbnail ("facade") — the YouTube player
// iframe pulls in several hundred KB of scripts and was slowing the first paint of
// the page. The real player only loads when a visitor presses play, and starts
// playing straight away since that press is the interaction.
const HERO_VIDEO_ID = "j4p2_PcHV_M";
const HERO_VIDEO_TITLE = "How to use FitForce";
const THUMBNAIL_BASE_URL = `https://i.ytimg.com/vi/${HERO_VIDEO_ID}`;

export default function LandingHeroVideo() {
    const t = useTranslations("landing.hero");
    const [isPlaying, setIsPlaying] = useState(false);
    // maxresdefault doesn't exist for every video; hqdefault always does.
    const [thumbnail, setThumbnail] = useState(`${THUMBNAIL_BASE_URL}/maxresdefault.jpg`);

    return (
        <div className="relative mt-8 w-full max-w-5xl min-w-0">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-4 rounded-3xl blur-lg"
                style={{
                    background:
                        "linear-gradient(90deg, color-mix(in oklch, var(--color-primary) 15%, transparent), color-mix(in oklch, var(--color-primary) 8%, transparent))",
                }}
            />
            <div
                className="relative w-full aspect-video rounded-2xl border-2 overflow-hidden bg-black/40"
                style={{
                    borderColor: "color-mix(in oklch, var(--color-primary) 30%, transparent)",
                    boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
                }}
            >
                {isPlaying ? (
                    <iframe
                        src={`https://www.youtube-nocookie.com/embed/${HERO_VIDEO_ID}?rel=0&autoplay=1`}
                        title={HERO_VIDEO_TITLE}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsPlaying(true)}
                        aria-label={t("playVideo")}
                        className="group absolute inset-0 h-full w-full cursor-pointer"
                    >
                        <img
                            src={thumbnail}
                            alt=""
                            fetchPriority="high"
                            decoding="async"
                            onError={() => setThumbnail(`${THUMBNAIL_BASE_URL}/hqdefault.jpg`)}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                        <span aria-hidden="true" className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/15" />
                        <span
                            aria-hidden="true"
                            className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform duration-300 group-hover:scale-110 sm:h-20 sm:w-20"
                        >
                            <Play className="h-7 w-7 translate-x-0.5 fill-current sm:h-9 sm:w-9" />
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
