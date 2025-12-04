"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/lib/landing/LanguageContext";
import { useScrollAnimation } from "@/lib/landing/useScrollAnimation";

interface FeatureSectionProps {
  featureKey: string;
  screenshot?: string;
}

export default function FeatureSection({
  featureKey,
  screenshot,
}: FeatureSectionProps) {
  const { t, dir } = useLanguage();
  const contentRef = useScrollAnimation();
  const imageRef = useScrollAnimation();

  // @ts-ignore
  const feature = t.features[featureKey];

  return (
    <section
      className="h-screen flex items-center bg-[var(--bg-primary)] relative scroll-snap-section scroll-snap-center"
      dir={dir}
    >
      {/* Optimized background glow */}
      <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-gradient-to-r from-cyan-500/6 to-blue-600/6 rounded-full blur-2xl"></div>

      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 w-full py-6 sm:py-8 md:py-12 lg:py-16 relative z-10">
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8 lg:gap-12 items-center ${
            dir === "rtl" ? "direction-rtl" : "direction-ltr"
          }`}
        >
          {/* Feature Info */}
          <div
            ref={contentRef}
            className={`w-full flex flex-col animate-on-scroll fade-in-left ${
              dir === "rtl" 
                ? "text-right items-end" 
                : "text-left items-start"
            }`}
            style={dir === "rtl" ? { direction: "rtl" } : { direction: "ltr" }}
          >
            <h2 className={`w-full text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4 sm:mb-6 tracking-tight ${
              dir === "rtl" ? "text-right" : "text-left"
            }`}>
              {feature.title}
            </h2>
            <ul className={`w-full space-y-3 sm:space-y-4 mb-6 sm:mb-8 ${
              dir === "rtl" ? "text-right" : "text-left"
            }`}>
              {Array.isArray(feature.description) &&
                feature.description.map((point: string, index: number) => (
                  <li key={index} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5"
                      viewBox="0 0 20 20"
                      fill="none"
                    >
                      <path
                        d="M2 10L6 14L14 4"
                        stroke="#0EA5E9"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6 10L10 14L18 4"
                        stroke="#06B6D4"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className={`text-base sm:text-lg md:text-xl text-[var(--text-secondary)] leading-relaxed flex-1 ${
                      dir === "rtl" ? "text-right" : "text-left"
                    }`}>
                      {point}
                    </span>
                  </li>
                ))}
            </ul>
            <div className="flex flex-col gap-3 w-full">
              <Link
                href="/register"
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 shadow-lg shadow-cyan-500/40 text-center"
              >
                {t.hero.cta}
              </Link>
              <p className={`text-sm text-[var(--text-tertiary)] ${
                dir === "rtl" ? "text-right" : "text-left"
              }`}>
                {t.hero.noCreditCard}
              </p>
            </div>
          </div>

          {/* Screenshot with glass card effect */}
          <div
            ref={imageRef}
            className="relative w-full flex justify-center lg:block"
          >
            {/* Optimized outer glow */}
            <div className="absolute -inset-3 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-3xl blur-lg"></div>

            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gray-900/40 backdrop-blur-xl border border-cyan-500/20 aspect-video w-full max-w-xl mx-auto">
              {screenshot ? (
                <Image
                  src={screenshot}
                  alt={feature.title}
                  fill
                  className="object-cover"
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                  quality={100}
                  unoptimized={screenshot.startsWith("/")}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900/50 to-black/50">
                  <div className="text-center p-8">
                    <p className="text-gray-400 font-semibold">
                      Feature Screenshot
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
