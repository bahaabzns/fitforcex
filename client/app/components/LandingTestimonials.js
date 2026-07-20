'use client';

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useScrollReveal } from "@/lib/useScrollReveal";

// lucide-react doesn't ship brand/social icons — inline glyph instead.
function InstagramIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
    );
}

const COACHES = [
    {
        id: "coach1",
        image: "/basuo 3.png",
        instagram: { username: "@basuoo", url: "https://instagram.com/basuoo", followers: "250K" },
    },
    {
        id: "coach2",
        image: "/agamal.png",
        instagram: { username: "@dr.agamal", url: "https://instagram.com/dr.agamal", followers: "180K" },
    },
];

const AUTOPLAY_MS = 5000;
const TRANSITION_MS = 800;

export default function LandingTestimonials() {
    const t = useTranslations("landing.trustedBy");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const headerRef = useScrollReveal();
    const timerRef = useRef(null);

    const total = COACHES.length;

    function goTo(index) {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentIndex(((index % total) + total) % total);
        setTimeout(() => setIsTransitioning(false), TRANSITION_MS);
    }

    function next() {
        goTo(currentIndex + 1);
    }

    function prev() {
        goTo(currentIndex - 1);
    }

    useEffect(() => {
        if (isHovering || isTransitioning) return undefined;
        timerRef.current = setTimeout(() => next(), AUTOPLAY_MS);
        return () => clearTimeout(timerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, isHovering, isTransitioning]);

    function relativePosition(index) {
        let diff = index - currentIndex;
        if (diff > total / 2) diff -= total;
        if (diff < -total / 2) diff += total;
        return diff;
    }

    function cardStyle(position) {
        const isCenter = position === 0;
        const abs = Math.abs(position);
        const scale = isCenter ? 1 : abs === 1 ? 0.7 : 0.5;
        const opacity = isCenter ? 1 : abs === 1 ? 0.25 : 0;
        const blur = isCenter ? 0 : abs === 1 ? 2 : 4;
        const brightness = isCenter ? 1 : abs === 1 ? 0.7 : 0.5;
        const translateY = isCenter ? 0 : abs === 1 ? 20 : 40;
        const translateX = position * 340;

        return {
            transform: `translateX(${translateX}px) translateY(${translateY}px) scale(${scale})`,
            opacity,
            filter: `blur(${blur}px) brightness(${brightness})`,
            zIndex: isCenter ? 30 : abs === 1 ? 10 : 5,
            transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.22,1,0.36,1), opacity ${TRANSITION_MS}ms cubic-bezier(0.22,1,0.36,1), filter ${TRANSITION_MS}ms cubic-bezier(0.22,1,0.36,1)`,
        };
    }

    return (
        <section
            id="coaches"
            className="relative overflow-hidden py-16 md:py-20 flex flex-col items-center justify-center"
        >
            {/* Background glow */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-200 rounded-full blur-3xl"
                style={{ background: "color-mix(in oklch, var(--color-primary) 10%, transparent)" }}
            />

            <div ref={headerRef} className="animate-on-scroll fade-in-up relative z-10 text-center px-6 mb-12 md:mb-16">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white">{t("title")}</h2>
                <p className="mt-4 text-white/60 max-w-2xl mx-auto">{t("subtitle")}</p>
            </div>

            {/* Desktop nav arrows */}
            <button
                type="button"
                onClick={prev}
                aria-label="Previous"
                className="hidden md:flex absolute inset-s-8 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-12 h-12 rounded-full border backdrop-blur-md transition-transform hover:scale-110"
                style={{
                    background: "color-mix(in oklch, var(--color-primary) 15%, transparent)",
                    borderColor: "color-mix(in oklch, var(--color-primary) 30%, transparent)",
                }}
            >
                <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
                type="button"
                onClick={next}
                aria-label="Next"
                className="hidden md:flex absolute inset-e-8 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-12 h-12 rounded-full border backdrop-blur-md transition-transform hover:scale-110"
                style={{
                    background: "color-mix(in oklch, var(--color-primary) 15%, transparent)",
                    borderColor: "color-mix(in oklch, var(--color-primary) 30%, transparent)",
                }}
            >
                <ChevronRight className="w-5 h-5 text-white" />
            </button>

            {/* Coverflow */}
            <div
                className="relative z-10 w-full flex items-center justify-center"
                style={{ height: 500 }}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                {COACHES.map((coach, i) => {
                    const position = relativePosition(i);
                    const isCenter = position === 0;
                    const tCoach = t.raw(coach.id);
                    return (
                        <div
                            key={coach.id}
                            className="absolute w-70 h-100 md:w-80 md:h-112.5 lg:w-87.5 lg:h-125 rounded-2xl overflow-hidden"
                            style={{
                                ...cardStyle(position),
                                boxShadow: isCenter
                                    ? "0 25px 70px color-mix(in oklch, var(--color-primary) 40%, transparent), 0 10px 30px color-mix(in oklch, var(--color-primary) 30%, transparent)"
                                    : undefined,
                            }}
                        >
                            <Image src={coach.image} alt={tCoach.name} fill className="object-cover" unoptimized />

                            {/* Info overlay */}
                            <div className="absolute inset-x-0 bottom-0 p-5 pt-12 bg-linear-to-t from-black/90 via-black/70 to-transparent border-t border-primary/20 rounded-b-2xl">
                                <h3
                                    className="text-xl md:text-2xl font-bold text-primary"
                                    style={{ opacity: isCenter ? 1 : 0, transition: `opacity ${TRANSITION_MS}ms ease` }}
                                >
                                    {tCoach.name}
                                </h3>
                                <p
                                    className="mt-1 text-xs md:text-sm text-white/70"
                                    style={{ opacity: isCenter ? 1 : 0, transition: `opacity ${TRANSITION_MS}ms ease` }}
                                >
                                    {tCoach.description}
                                </p>
                                <a
                                    href={coach.instagram.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs text-white/85 transition-colors"
                                    style={{
                                        opacity: isCenter ? 1 : 0,
                                        pointerEvents: isCenter ? "auto" : "none",
                                        transition: `opacity ${TRANSITION_MS}ms ease`,
                                        background: "color-mix(in oklch, var(--color-primary) 15%, transparent)",
                                        borderColor: "color-mix(in oklch, var(--color-primary) 30%, transparent)",
                                    }}
                                >
                                    <InstagramIcon className="w-3.5 h-3.5" />
                                    {coach.instagram.username} · {coach.instagram.followers} followers
                                </a>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Mobile nav arrows */}
            <div className="flex md:hidden gap-4 mt-6 relative z-10">
                <button
                    type="button"
                    onClick={prev}
                    aria-label="Previous"
                    className="flex items-center justify-center w-11 h-11 rounded-full border"
                    style={{
                        background: "color-mix(in oklch, var(--color-primary) 15%, transparent)",
                        borderColor: "color-mix(in oklch, var(--color-primary) 30%, transparent)",
                    }}
                >
                    <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button
                    type="button"
                    onClick={next}
                    aria-label="Next"
                    className="flex items-center justify-center w-11 h-11 rounded-full border"
                    style={{
                        background: "color-mix(in oklch, var(--color-primary) 15%, transparent)",
                        borderColor: "color-mix(in oklch, var(--color-primary) 30%, transparent)",
                    }}
                >
                    <ChevronRight className="w-5 h-5 text-white" />
                </button>
            </div>
        </section>
    );
}
