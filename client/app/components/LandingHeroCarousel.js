'use client';

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, Play, Pause } from "lucide-react";

const TAB_IDS = ["nutrition", "workout", "onboard", "conversations", "forms", "packages"];

const VIDEO_FILES = {
    nutrition: "/hero_videos/Design Nutrition Plans.mp4",
    workout: "/hero_videos/Build Workout Plans.mp4",
    onboard: "/hero_videos/Onboard Clients.mp4",
    conversations: "/hero_videos/Start Conversations.mp4",
    forms: "/hero_videos/Create Forms.mp4",
    packages: "/hero_videos/Setup Packages.mp4",
};

const TRANSLATION_KEYS = {
    nutrition: ["dietPlan", "dietPlanDesc"],
    workout: ["workoutPlan", "workoutPlanDesc"],
    onboard: ["createClient", "createClientDesc"],
    conversations: ["chatClient", "chatClientDesc"],
    forms: ["createForm", "createFormDesc"],
    packages: ["createPackages", "createPackagesDesc"],
};

export default function LandingHeroCarousel() {
    const t = useTranslations("landing.modulesSlider");
    const tabs = TAB_IDS.map((id) => {
        const [labelKey, descKey] = TRANSLATION_KEYS[id];
        return { id, label: t(labelKey), subtitle: t(descKey) };
    });

    const [active, setActive] = useState(0);
    const [indicator, setIndicator] = useState({ left: 0, width: 0 });
    const [typedText, setTypedText] = useState("");
    const [isPaused, setIsPaused] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [renderedActive, setRenderedActive] = useState(active);
    const tabRefs = useRef([]);
    const listRef = useRef(null);
    const videoRef = useRef(null);

    // Reset per-tab UI state during render (not in an effect) when the active
    // tab changes — avoids the cascading-render footgun of setState-in-effect.
    if (active !== renderedActive) {
        setRenderedActive(active);
        setTypedText("");
        setIsLoading(true);
        setIsPaused(false);
        setProgress(0);
    }

    useLayoutEffect(() => {
        const update = () => {
            const tab = tabRefs.current[active];
            const list = listRef.current;
            if (!tab || !list) return;
            const tabRect = tab.getBoundingClientRect();
            const listRect = list.getBoundingClientRect();
            setIndicator({ left: tabRect.left - listRect.left, width: tabRect.width });
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, [active]);

    // Typewriter caption — types out the active tab's subtitle one char at a time.
    useEffect(() => {
        const full = tabs[active].subtitle;
        let i = 0;
        const interval = setInterval(() => {
            i += 1;
            setTypedText(full.slice(0, i));
            if (i >= full.length) clearInterval(interval);
        }, 30);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    function handleProgress() {
        const video = videoRef.current;
        if (!video || !video.duration) return;
        setProgress((video.currentTime / video.duration) * 100);
    }

    function togglePlayPause() {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play();
            setIsPaused(false);
        } else {
            video.pause();
            setIsPaused(true);
        }
    }

    function restart() {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = 0;
        video.play();
        setIsPaused(false);
    }

    return (
        <div className="mt-8 w-full max-w-5xl min-w-0 flex flex-col gap-6">

            {/* ── Tab strip — single scrollable row on mobile, wraps + centers from sm up ── */}
            <div
                ref={listRef}
                role="tablist"
                aria-label={t("ariaLabel")}
                className="scrollbar-hide relative flex flex-nowrap sm:flex-wrap justify-start sm:justify-center items-center gap-0.5 overflow-x-auto sm:overflow-visible rounded-full border border-white/10 bg-white/5 p-1"
            >
                {/* Sliding indicator pill */}
                <div
                    aria-hidden="true"
                    className="absolute rounded-full bg-white/15 pointer-events-none transition-[left,width] duration-200 ease-in-out"
                    style={{ top: 4, bottom: 4, left: indicator.left, width: indicator.width }}
                />

                {tabs.map((tab, i) => (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={i === active}
                        ref={(el) => { tabRefs.current[i] = el; }}
                        onClick={() => setActive(i)}
                        className={`relative z-10 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors duration-200 ${
                            i === active
                                ? "text-white"
                                : "text-white/50 hover:text-white/80"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Typewriter caption ── */}
            <p
                className="text-xl sm:text-2xl font-bold text-primary text-center leading-snug min-h-[2em]"
                style={{ textShadow: "0 0 20px color-mix(in oklch, var(--color-primary) 50%, transparent)" }}
            >
                {typedText}
                <span className="inline-block w-0.5 h-[1em] align-middle ms-0.5 bg-primary animate-pulse" />
            </p>

            {/* ── Glass video panel ── */}
            <div className="relative">
                {/* Glow wrapper */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-4 rounded-3xl blur-lg"
                    style={{
                        background:
                            "linear-gradient(90deg, color-mix(in oklch, var(--color-primary) 15%, transparent), color-mix(in oklch, var(--color-primary) 8%, transparent))",
                    }}
                />

                <div
                    className="relative w-full rounded-2xl border-2 overflow-hidden bg-black/40 backdrop-blur-xl"
                    style={{
                        borderColor: "color-mix(in oklch, var(--color-primary) 30%, transparent)",
                        boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
                    }}
                >
                    <video
                        key={tabs[active].id}
                        ref={videoRef}
                        src={VIDEO_FILES[tabs[active].id]}
                        className="w-full aspect-video object-cover"
                        loop
                        muted
                        autoPlay
                        playsInline
                        preload="auto"
                        onLoadedData={() => setIsLoading(false)}
                        onTimeUpdate={handleProgress}
                    />

                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        </div>
                    )}

                    {/* Restart + play/pause controls */}
                    <div className="absolute top-3 inset-e-3 flex gap-2">
                        <button
                            type="button"
                            onClick={restart}
                            aria-label="Restart"
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-black/70 hover:bg-black/80 text-primary border border-primary/50 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={togglePlayPause}
                            aria-label={isPaused ? "Play" : "Pause"}
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-black/70 hover:bg-black/80 text-primary border border-primary/50 transition-colors"
                        >
                            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Progress bar */}
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-black/50">
                        <div
                            className="h-full bg-primary transition-[width] duration-100 ease-linear"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

        </div>
    );
}
