"use client";

import { useLanguage } from "@/lib/landing/LanguageContext";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function FoundersWord() {
  const { t, dir } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [posterUrl, setPosterUrl] = useState<string>("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let captured = false;

    const captureFrame = () => {
      if (!video) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        if (dataUrl) {
          setPosterUrl(dataUrl);
        }
      } catch {}
    };

    const onLoadedMetadata = () => {
      // Seek near the end to get the last frame
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0) {
        // Seek slightly before the end to ensure a decodable frame
        video.currentTime = Math.max(0, duration - 0.2);
      }
    };

    const onSeeked = () => {
      if (captured) return;
      captured = true;
      captureFrame();
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("seeked", onSeeked);

    // Fallback: if seek doesn't trigger, try capturing on canplay
    const onCanPlay = () => {
      if (!captured) {
        captureFrame();
        captured = true;
      }
    };
    video.addEventListener("canplay", onCanPlay);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("canplay", onCanPlay);
    };
  }, []);

  return (
    <section
      id="foundersword"
      className="min-h-screen bg-[var(--bg-primary)] relative scroll-snap-section scroll-snap-center overflow-hidden py-16 md:py-20 flex items-center"
      dir={dir}
    >
      {/* Optimized background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)]"></div>
      <div className="absolute top-1/3 left-1/3 w-[600px] h-[600px] bg-gradient-to-r from-cyan-500/8 to-blue-600/8 rounded-full blur-2xl"></div>

      <div className="section-container relative z-10 py-8 w-full">
        {/* Header - Full Width */}
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[var(--text-primary)] mb-4 tracking-tight">
            {t?.foundersword?.title || "From a Coach, To Coaches"}
          </h2>
          <p className="text-lg md:text-xl text-[var(--text-secondary)] leading-relaxed max-w-3xl mx-auto">
            {t?.foundersword?.subtitle ||
              "Built by coaches who understand your challenges"}
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center max-w-7xl mx-auto px-2 sm:px-4">
          {/* Left Column - Video */}
          <div className="relative group order-2 md:order-1">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-purple-500/15 rounded-3xl blur-lg pointer-events-none"></div>

            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl bg-black/40 backdrop-blur-xl border-2 border-cyan-500/30 transition-all duration-300 hover:border-cyan-500/50 hover:shadow-cyan-500/20">
              <video
                ref={videoRef}
                className="w-full h-auto max-h-[400px] md:max-h-[500px] object-cover"
                controls
                preload="metadata"
                poster={posterUrl || "/founderbahaa.png"}
              >
                <source src="/founder_video.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Decorative glow effects */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-400 rounded-full opacity-30 blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500 rounded-full opacity-30 blur-3xl pointer-events-none"></div>
          </div>

          {/* Right Column - Quote Card */}
          <div className="order-1 md:order-2">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 md:p-8 shadow-lg hover:border-cyan-500/40 hover:bg-gray-900/70 transition-all duration-300 ease-in-out shadow-cyan-500/5 hover:shadow-cyan-500/20">
              <div className="mb-6">
                <svg
                  className="w-10 h-10 md:w-12 md:h-12 text-cyan-400/40 mx-auto md:mx-0 mb-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
              </div>
              <p
                className={`text-base md:text-lg text-[var(--text-secondary)] leading-relaxed mb-6 italic ${
                  dir === "rtl" ? "text-right" : "text-left"
                }`}
                dir={dir}
              >
                {t?.foundersGuarantee?.quote ??
                  (dir === "rtl"
                    ? "أنشأت FitForce لأنني أؤمن بأن كل مدرب يستحق أدوات تمكنه وليس تحده. إذا لم تحول FitForce طريقة إدارتك لأعمالك التدريبية خلال 7 أيام، أريد أن أسمع منك شخصياً."
                    : "I built FitForce because I believe every coach deserves tools that empower them, not limit them. If FitForce doesn't transform how you manage your coaching business within 7 days, I want to hear from you personally.")}
              </p>

              {/* Guarantees List */}
              {t?.foundersGuarantee?.guarantees && (
                <div className="mb-6 space-y-3">
                  {t.foundersGuarantee.guarantees.map(
                    (guarantee: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-3">
                        <svg
                          className="w-5 h-5 text-cyan-400 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-sm md:text-base text-[var(--text-secondary)]">
                          {guarantee}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="flex flex-col items-start gap-2 border-t border-cyan-500/20 pt-6">
                <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                  {t?.foundersGuarantee?.founderName || "Dr. Bahaa"}
                </p>
                <p className="text-sm text-[var(--text-tertiary)]">
                  {t?.foundersGuarantee?.founderTitle ||
                    "Founder & CEO, FitForce"}
                </p>
              </div>

              {/* CTA Buttons */}
              {(t?.foundersGuarantee?.cta ||
                t?.foundersGuarantee?.ctaSecondary) && (
                <div className="mt-6 pt-6 border-t border-cyan-500/10 flex flex-col sm:flex-row gap-3">
                  {t?.foundersGuarantee?.cta && (
                    <a
                      href="#pricing"
                      className="flex-1 inline-flex items-center justify-center px-5 py-3 text-sm md:text-base font-bold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-300"
                    >
                      {t.foundersGuarantee.cta}
                    </a>
                  )}
                  {/* {t?.foundersGuarantee?.ctaSecondary && (
                    <a
                      href="https://wa.me/201025258083"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center px-5 py-3 text-sm md:text-base font-bold rounded-lg bg-transparent border-2 border-cyan-500/30 hover:border-cyan-500/60 text-[var(--text-primary)] hover:bg-cyan-500/5 transition-all duration-300"
                    >
                      {t.foundersGuarantee.ctaSecondary}
                    </a>
                  )} */}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
