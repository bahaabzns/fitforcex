'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/lib/landing/LanguageContext';
import { useScrollAnimation } from '@/lib/landing/useScrollAnimation';

interface FeatureSectionProps {
  featureKey: string;
  icon: React.ReactNode;
  screenshot?: string;
}

export default function FeatureSection({ featureKey, icon, screenshot }: FeatureSectionProps) {
  const { t, dir } = useLanguage();
  const contentRef = useScrollAnimation();
  const imageRef = useScrollAnimation();

  type FeatureContent = {
    title: string;
    description: string;
  };

  const featureMap = t.features as Record<string, FeatureContent>;
  const feature = featureMap[featureKey];

  if (!feature) {
    return null;
  }

  return (
    <section className="h-screen flex items-center bg-[var(--bg-primary)] relative scroll-snap-section scroll-snap-center" dir={dir}>
      {/* Optimized background glow */}
      <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-gradient-to-r from-cyan-500/6 to-blue-600/6 rounded-full blur-2xl"></div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full py-8 sm:py-12 md:py-16 relative z-10">
        <div className={`grid lg:grid-cols-2 gap-6 sm:gap-8 md:gap-12 items-center ${dir === 'rtl' ? 'direction-rtl' : ''}`}>
          {/* Feature Info */}
          <div
            ref={contentRef}
            className={`text-center animate-on-scroll fade-in-left ${dir === 'rtl' ? 'lg:text-right' : 'lg:text-left'}`}
          >
            <div
              className={`w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-cyan-400 mb-8 border border-cyan-500/40 shadow-lg shadow-cyan-500/20 transition-all duration-300 ${dir === 'rtl' ? 'mx-auto lg:mr-0 lg:ml-auto' : 'mx-auto lg:mx-0'}`}
            >
              {icon}
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-[var(--text-primary)] mb-4 sm:mb-6 tracking-tight">
              {feature.title}
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-[var(--text-secondary)] leading-relaxed mb-6 sm:mb-8">
              {feature.description}
            </p>
            <div className="flex flex-col gap-3">
            <Link
              href="/register"
              className="inline-block bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 shadow-lg shadow-cyan-500/40 text-center"
            >
              {t.hero.cta}
            </Link>
              <p className="text-sm text-[var(--text-tertiary)]">{t.hero.noCreditCard}</p>
            </div>
          </div>

          {/* Screenshot with glass card effect */}
          <div ref={imageRef} className="relative animate-on-scroll fade-in-right">
            {/* Optimized outer glow */}
            <div className="absolute -inset-3 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-3xl blur-lg"></div>

            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gray-900/40 backdrop-blur-xl border border-cyan-500/20 aspect-video">
              {screenshot ? (
                <Image
                  src={screenshot}
                  alt={feature.title}
                  fill
                  className="object-cover"
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900/50 to-black/50">
                  <div className="text-center p-8">
                    <div className="w-24 h-24 mx-auto mb-4 text-cyan-400/50">{icon}</div>
                    <p className="text-gray-400 font-semibold">Feature Screenshot</p>
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
