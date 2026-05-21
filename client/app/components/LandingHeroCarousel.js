'use client';

import { useState, useRef, useLayoutEffect } from "react";

const tabs = [
    {
        id: "nutrition",
        label: "Design Nutrition Plans",
        subtitle: "Design personalized diet plans with macros, meals, and substitutions.",
    },
    {
        id: "workout",
        label: "Build Workout Plans",
        subtitle: "Build structured workout plans with progression, rest, and equipment.",
    },
    {
        id: "onboard",
        label: "Onboard Clients",
        subtitle: "Quickly onboard a new client with essential details and goals.",
    },
    {
        id: "conversations",
        label: "Start Conversations",
        subtitle: "Keep conversations flowing with in-app chat and media.",
    },
    {
        id: "forms",
        label: "Create Forms",
        subtitle: "Create assessment forms and collect responses in one place.",
    },
    {
        id: "packages",
        label: "Setup Packages",
        subtitle: "Set up package offerings, pricing, and renewals for clients.",
    },
];

export default function LandingHeroCarousel() {
    const [active, setActive] = useState(0);
    const [indicator, setIndicator] = useState({ left: 0, width: 0 });
    const tabRefs = useRef([]);
    const listRef = useRef(null);

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

    return (
        <div className="mt-8 w-full max-w-5xl flex flex-col gap-6">

            {/* ── Tab strip ── */}
            <div
                ref={listRef}
                role="tablist"
                className="relative flex flex-wrap justify-center items-center rounded-full border border-white/10 bg-white/5 p-1"
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

            {/* ── Active subtitle ── */}
            <p className="text-xl sm:text-2xl font-bold text-primary text-center leading-snug">
                {tabs[active].subtitle}
            </p>

            {/* ── Screenshot ── */}
            <div
                className="w-full rounded-2xl border border-white/10 overflow-hidden"
                style={{
                    boxShadow:
                        "0 0 0 1px rgba(255,255,255,0.05), 0 40px 80px rgba(0,0,0,0.6), 0 0 60px color-mix(in oklch, var(--color-primary) 8%, transparent)",
                }}
            >
                <img
                    src="/image_placeholder.png"
                    alt={tabs[active].label}
                    className="w-full"
                />
            </div>

        </div>
    );
}
