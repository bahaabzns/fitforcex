'use client';

import { useState } from "react";
import { Card } from "@heroui/react/card";
import { Avatar } from "@heroui/react/avatar";
import { Chip } from "@heroui/react/chip";
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';

const testimonials = [
    {
        name: "Ibrahim Al-Rashidi",
        role: "Personal Trainer · Riyadh",
        initials: "IR",
        quote:
            "FitForce completely changed how I run my coaching business. I used to spend hours building plans manually — now I send a fully personalized plan to a new client in under 10 minutes. The client portal alone is worth every riyal.",
    },
    {
        name: "Sarah Al-Otaibi",
        role: "Nutrition Coach · Jeddah",
        initials: "SO",
        quote:
            "The nutrition builder is incredibly detailed. I can cycle macros, set meal targets, and attach substitutions — all in one flow. My clients actually follow through on their plans now because everything is so clear.",
    },
    {
        name: "Mohammed Khalil",
        role: "Strength & Conditioning Coach · Dubai",
        initials: "MK",
        quote:
            "I manage over 60 clients and FitForce keeps everything organized. The progress tracking gives me real data to adjust plans week by week. I couldn't imagine going back to spreadsheets.",
    },
];

function StarRating() {
    return (
        <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
                <Star
                    key={i}
                    className="h-4 w-4 fill-yellow-400 text-yellow-400"
                />
            ))}
        </div>
    );
}

export default function LandingTestimonials() {
    const [current, setCurrent] = useState(0);

    const prev = () =>
        setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);
    const next = () =>
        setCurrent((c) => (c + 1) % testimonials.length);

    const { name, role, initials, quote } = testimonials[current];

    return (
        <section id="coaches" className="py-16 md:py-24 px-6" style={{ background: "rgba(255,255,255,0.015)" }}>
            <div className="mx-auto max-w-4xl flex flex-col gap-12">

                {/* ── Heading ── */}
                <div className="text-center flex flex-col gap-4">
                    <Chip color="accent" size="sm" className="mx-auto">
                        Testimonials
                    </Chip>
                    <h2 className="text-4xl sm:text-5xl font-bold text-white">
                        Trusted by Top-Tier Coaches
                    </h2>
                    <p className="text-white/50 leading-relaxed">
                        Hear from coaches who've transformed their business with FitForce.
                    </p>
                </div>

                {/* ── Carousel ── */}
                <div className="flex items-center gap-4 sm:gap-6">

                    {/* Prev button */}
                    <button
                        onClick={prev}
                        aria-label="Previous testimonial"
                        className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>

                    {/* Card */}
                    <Card className="flex-1">
                        <Card.Content className="flex flex-col sm:flex-row gap-6 p-5 sm:p-8">

                            {/* Avatar column */}
                            <div className="flex flex-col items-center gap-3 sm:items-start shrink-0">
                                <Avatar size="lg" color="accent">
                                    <Avatar.Fallback>{initials}</Avatar.Fallback>
                                </Avatar>
                                <div className="text-center sm:text-left">
                                    <p className="font-bold text-foreground leading-tight">
                                        {name}
                                    </p>
                                    <p className="text-sm text-foreground/50 mt-0.5">
                                        {role}
                                    </p>
                                </div>
                                <StarRating />
                            </div>

                            {/* Divider */}
                            <div className="hidden sm:block w-px bg-border shrink-0" />

                            {/* Quote */}
                            <div className="flex flex-col justify-center gap-3">
                                <span
                                    className="text-5xl leading-none text-primary/40 font-serif select-none"
                                    aria-hidden="true"
                                >
                                    &ldquo;
                                </span>
                                <p className="text-foreground/70 leading-relaxed italic text-base sm:text-lg -mt-3">
                                    {quote}
                                </p>
                            </div>

                        </Card.Content>
                    </Card>

                    {/* Next button */}
                    <button
                        onClick={next}
                        aria-label="Next testimonial"
                        className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>

                </div>

                {/* ── Dot indicators ── */}
                <div className="flex justify-center gap-2">
                    {testimonials.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrent(i)}
                            aria-label={`Go to testimonial ${i + 1}`}
                            className={`h-2 rounded-full transition-all duration-200 ${
                                i === current
                                    ? "w-6 bg-primary"
                                    : "w-2 bg-white/20 hover:bg-white/40"
                            }`}
                        />
                    ))}
                </div>

            </div>
        </section>
    );
}
