"use client";

import { useLanguage } from "@/lib/landing/LanguageContext";
import { useScrollAnimation } from "@/lib/landing/useScrollAnimation";
import Button from "./Button";

export default function QuickDemo() {
  const { t, dir } = useLanguage();
  const contentRef = useScrollAnimation();

  return (
    <section
      id="demo"
      className="h-screen flex items-center bg-[var(--bg-primary)] relative scroll-snap-section scroll-snap-center"
      dir={dir}
    >
      {/* Optimized background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-cyan-500/6 to-blue-600/6 rounded-full blur-2xl"></div>

      <div className="section-container py-8 sm:py-12 md:py-16 relative z-10">
        <div
          ref={contentRef}
          className="max-w-4xl mx-auto text-center animate-on-scroll fade-in-up px-4"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-[var(--text-primary)] mb-3 sm:mb-4 tracking-tight">
            {t.demo.title}
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-[var(--text-secondary)] mb-8 sm:mb-12">
            {t.demo.subtitle}
          </p>

          {/* Video Placeholder */}
          <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-900 to-black mb-8 border-2 border-cyan-500/30">
            {/* Outer neon glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 rounded-3xl blur-xl -z-10"></div>

            <div className="absolute inset-0 flex items-center justify-center">
              <button className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center hover:scale-110 transition-all duration-300 shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70 group relative">
                <svg
                  className="w-8 h-8 text-white ml-1 relative z-10 group-hover:scale-110 transition-transform duration-300"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
            {/* Placeholder text */}
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
              <p className="text-white text-sm font-semibold">
                60-Second Demo Video
              </p>
            </div>
          </div>

          <Button href="/register" size="lg">
            {t.demo.cta}
          </Button>
        </div>
      </div>
    </section>
  );
}
