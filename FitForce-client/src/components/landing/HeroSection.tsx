'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/landing/LanguageContext';
import Button from './Button';

export default function HeroSection() {
  const { t, dir } = useLanguage();
  const [isPaused, setIsPaused] = useState(false);
  const [gifSrc, setGifSrc] = useState('/demo.gif');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const togglePause = () => {
    if (isPaused) {
      setGifSrc('/demo.gif?t=' + new Date().getTime());
      setIsPaused(false);
    } else {
      const img = document.getElementById('demo-gif') as HTMLImageElement;
      if (img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setGifSrc(canvas.toDataURL());
          setIsPaused(true);
        }
      }
    }
  };

  const brandLogos = [
    {
      name: 'Nike',
      icon: 'M 24.129 23.412 c -0.054 -0.022 -0.108 -0.045 -0.162 -0.067 c -9.701 -3.868 -16.17 -13.239 -16.17 -23.345 h 6.468 c 0 7.704 4.787 14.25 11.574 16.828 c 6.787 -2.578 11.574 -9.124 11.574 -16.828 h 6.468 c 0 10.106 -6.469 19.477 -16.17 23.345 c -0.054 0.022 -0.108 0.045 -0.162 0.067 c -0.573 0.235 -1.193 0.363 -1.828 0.363 c -0.635 0 -1.255 -0.128 -1.828 -0.363 Z'
    },
    {
      name: 'Adidas',
      icon: 'M 18.88 9.88 L 10.11 28.89 h 8.77 l 2.35 -6.23 h 7.62 l 2.35 6.23 h 8.77 L 21.12 9.88 h -2.24 z m 1.12 5.67 l 2.48 6.57 h -4.96 l 2.48 -6.57 z'
    },
    { name: 'Reebok', icon: 'M 12 3 L 2 12 l 10 10 l 10 -10 L 12 3 z m 0 3.83 L 18.17 12 L 12 18.17 L 5.83 12 L 12 6.83 z' },
    { name: 'Under Armour', icon: 'M 20 4 v 16 l -8 4 l -8 -4 V 4 l 8 4 l 8 -4 z m -8 6 l -6 -3 v 10 l 6 3 l 6 -3 V 7 l -6 3 z' },
    {
      name: 'Puma',
      icon: 'M 20 9 c -1.1 0 -2 .9 -2 2 v 2 c 0 1.1 .9 2 2 2 h 2 c 1.1 0 2 -.9 2 -2 v -2 c 0 -1.1 -.9 -2 -2 -2 h -2 z M 8 13 c -1.1 0 -2 .9 -2 2 v 4 c 0 1.1 .9 2 2 2 h 8 c 1.1 0 2 -.9 2 -2 v -4 c 0 -1.1 -.9 -2 -2 -2 H 8 z'
    },
    {
      name: 'New Balance',
      icon: 'M 12 2 L 2 7 v 10 l 10 5 l 10 -5 V 7 L 12 2 z m 0 3.84 L 18.16 8.5 L 12 11.16 L 5.84 8.5 L 12 5.84 z m -8 4.83 l 7 3.5 v 6.99 l -7 -3.5 v -6.99 z'
    }
  ];

  // No JS-driven marquee needed; use pure CSS animation with duplicated sets.

  return (
    <section className="min-h-screen bg-[var(--bg-primary)] relative scroll-snap-section scroll-snap-start overflow-hidden" dir={dir}>
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)]"></div>

      {/* Optimized single radial glow - reduced from 3 orbs to 1 for better performance */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,90vw)] h-[600px] sm:w-[min(800px,100vw)] sm:h-[800px] bg-gradient-to-r from-cyan-500/12 via-blue-600/8 to-purple-700/6 rounded-full blur-2xl"></div>

      {/* Animated gradient orb - removed for performance */}

      {/* Scrollable content */}
      <div className="w-full relative z-10 pt-40 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1400px] mx-auto">
          {/* Hero Content */}
          <div
            className={`flex flex-col items-center text-center mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <div className="mb-12 max-w-5xl">
              <h1
                className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-[var(--text-primary)] mb-4 sm:mb-6 leading-[1.1] tracking-tight transition-all duration-500 delay-75 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              >
                {t.hero.title}
              </h1>
              <p
                className={`text-base sm:text-lg md:text-xl lg:text-2xl text-[var(--text-secondary)] mb-6 sm:mb-8 leading-relaxed max-w-2xl mx-auto transition-all duration-500 delay-150 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} ${dir === 'rtl' ? 'text-center' : 'text-center'}`}
              >
                {t.hero.subtitle}
              </p>

              {/* Social Proof Stats */}
              <div
                className={`flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8 transition-all duration-500 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              >
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-1">
                    10,000+
                  </div>
                  <div className="text-xs sm:text-sm text-[var(--text-tertiary)]">Active Coaches</div>
                </div>
                <div className="h-12 w-px bg-cyan-500/20"></div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-1">
                    500K+
                  </div>
                  <div className="text-xs sm:text-sm text-[var(--text-tertiary)]">Clients Managed</div>
                </div>
                <div className="h-12 w-px bg-cyan-500/20"></div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-1">
                    4.9★
                  </div>
                  <div className="text-xs sm:text-sm text-[var(--text-tertiary)]">User Rating</div>
                </div>
              </div>

              <div
                className={`flex flex-col sm:flex-row gap-4 justify-center mb-4 transition-all duration-500 delay-300 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
              >
                <Button href="/register" size="lg">
                  {t.hero.cta}
                </Button>
              </div>
              <p
                className={`text-sm text-[var(--text-tertiary)] transition-all duration-500 delay-400 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
              >
                ✓ {t.hero.noCreditCard}
              </p>
            </div>
          </div>

          {/* Full Demo GIF */}
          <div className="relative w-full mb-4 group">
            {/* Optimized outer glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-purple-500/15 rounded-3xl blur-lg"></div>

            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-black/40 backdrop-blur-xl border-2 border-cyan-500/30 transition-all duration-300">
              <img
                id="demo-gif"
                src={gifSrc}
                alt="FitForce Platform Demo"
                className="w-full h-auto"
                loading="eager"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              {/* Fallback placeholder */}
              <div className="hidden absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900/50 to-black/50 min-h-[400px]">
                <div className="text-center p-8">
                  <svg className="w-24 h-24 mx-auto mb-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-cyan-400 font-semibold text-lg">Add your demo.gif to /public folder</p>
                  <p className="text-[var(--text-tertiary)] text-sm mt-2">Animated product demo will appear here</p>
                </div>
              </div>

              {/* Pause/Play Button */}
              <button
                onClick={togglePause}
                className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md hover:bg-black/90 text-cyan-400 rounded-full p-3 shadow-xl transition-all hover:scale-110 active:scale-95 border-2 border-cyan-500/40 ring-2 ring-cyan-500/20 hover:ring-cyan-500/40"
                aria-label={isPaused ? 'Play demo' : 'Pause demo'}
              >
                {isPaused ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Decorative glow effects */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-400 rounded-full opacity-30 blur-3xl"></div>
            <div className="absolute top-0 left-0 w-40 h-40 bg-purple-500 rounded-full opacity-30 blur-3xl"></div>
          </div>
        </div>
      </div>

      {/* Trusted By Section - Static logos */}
      <div className="w-full overflow-hidden bg-gradient-to-b from-black to-gray-950 py-4 pb-16 md:pb-20">
        <div className="flex flex-wrap will-change-transform select-none gap-8 sm:gap-12 md:gap-16 lg:gap-20 justify-center px-4">
          <div className="flex flex-wrap gap-8 sm:gap-12 md:gap-16 lg:gap-20 justify-center">
            {brandLogos.map((brand, index) => (
              <div key={`set1-${index}`} className="flex-shrink-0 group">
                <div className="relative flex flex-col items-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center rounded-lg">
                    <svg
                      viewBox="0 0 48 48"
                      className="w-10 h-10 md:w-12 md:h-12 text-gray-600 group-hover:text-cyan-400 transition-colors duration-300"
                      fill="currentColor"
                    >
                      <path d={brand.icon} />
                    </svg>
                  </div>
                  <span className="mt-2 text-[10px] md:text-xs font-semibold text-gray-500 group-hover:text-cyan-400 transition-colors duration-300 tracking-wider uppercase">
                    {brand.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
