'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '@/lib/landing/LanguageContext';
import Button from './Button';

export default function HeroSection() {
  const { t, dir } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [gifDuration, setGifDuration] = useState(10000); // Default 10 seconds

  const typingRef = useRef<number | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const progressIntervalRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const workflows = useMemo(
    () => [
      t?.workflows?.dietPlan ?? 'make a diet plan',
      t?.workflows?.workoutPlan ?? 'make a workout plan',
      t?.workflows?.createClient ?? 'create new client',
      t?.workflows?.chatClient ?? 'chatting with a client',
      t?.workflows?.createForm ?? 'creating a form',
      t?.workflows?.createPackages ?? 'create new packages'
    ],
    [t]
  );

  const workflowDescriptions = useMemo(
    () => [
      t?.workflows?.dietPlanDesc ?? 'Design personalized diet plans with macros, meals, and substitutions.',
      t?.workflows?.workoutPlanDesc ?? 'Build structured workout plans with progression, rest, and equipment.',
      t?.workflows?.createClientDesc ?? 'Quickly onboard a new client with essential details and goals.',
      t?.workflows?.chatClientDesc ?? 'Keep conversations flowing with in-app chat and media.',
      t?.workflows?.createFormDesc ?? 'Create assessment forms and collect responses in one place.',
      t?.workflows?.createPackagesDesc ?? 'Set up package offerings, pricing, and renewals for clients.'
    ],
    [t]
  );

  const gifFiles = [
    'Design Nutrition Plans.gif',
    'Build Workout Plans.gif',
    'Onboard Clients.gif',
    'Start Conversations.gif',
    'Create Forms.gif',
    'Setup Packages.gif'
  ];

  // Approximate durations for each GIF in milliseconds (can be adjusted)
  const gifDurations = [15000, 18000, 12000, 10000, 20000, 12000];

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Handle video switching with pre-loaded videos
  useEffect(() => {
    // Stop all videos
    videoRefs.current.forEach((video, idx) => {
      if (video) {
        if (idx === activeIndex) {
          // Play the active video
          video.currentTime = 0;
          video.play().catch(() => {});
          setIsLoading(false);
        } else {
          // Pause inactive videos
          video.pause();
        }
      }
    });

    setIsPaused(false);
    setProgress(0);
  }, [activeIndex]);

  // Progress bar animation using video currentTime
  useEffect(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    if (!isPaused && videoRefs.current[activeIndex]) {
      progressIntervalRef.current = window.setInterval(() => {
        const video = videoRefs.current[activeIndex];
        if (video && !video.paused && video.duration) {
          const videoProgress = (video.currentTime / video.duration) * 100;
          setProgress(videoProgress);
        }
      }, 50);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPaused, activeIndex]);

  const togglePlayPause = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const video = videoRefs.current[activeIndex];
    if (video) {
      if (isPaused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
    setIsPaused(!isPaused);
  };

  const restartGif = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const video = videoRefs.current[activeIndex];
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
      setProgress(0);
      setIsPaused(false);
    }
  };

  // Typewriter effect
  useEffect(() => {
    if (typingRef.current) {
      clearInterval(typingRef.current);
    }

    const text = workflowDescriptions[activeIndex] || '';
    setTypedText('');
    let charIndex = 0;

    typingRef.current = window.setInterval(() => {
      charIndex++;
      // For RTL languages, reveal from the beginning (first chars appear on right, new chars added to left)
      if (dir === 'rtl') {
        setTypedText(text.slice(0, charIndex));
      } else {
        setTypedText(text.slice(0, charIndex));
      }
      if (charIndex >= text.length && typingRef.current) {
        clearInterval(typingRef.current);
        typingRef.current = null;
      }
    }, 30);

    return () => {
      if (typingRef.current) {
        clearInterval(typingRef.current);
      }
    };
  }, [activeIndex, workflowDescriptions, dir]);

  const navigateToNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Prevent scroll by keeping focus
    const scrollY = window.scrollY;
    setActiveIndex((prev) => (prev + 1) % workflows.length);
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  };

  const navigateToPrev = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Prevent scroll by keeping focus
    const scrollY = window.scrollY;
    setActiveIndex((prev) => (prev - 1 + workflows.length) % workflows.length);
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  };

  return (
    <section
      className="min-h-screen bg-[var(--bg-primary)] relative scroll-snap-section scroll-snap-start overflow-hidden"
      dir={dir}
      style={{ scrollSnapStop: 'normal' }}
    >
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)]"></div>

      {/* Optimized single radial glow - reduced from 3 orbs to 1 for better performance */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,90vw)] h-[600px] sm:w-[min(800px,100vw)] sm:h-[800px] bg-gradient-to-r from-cyan-500/12 via-blue-600/8 to-purple-700/6 rounded-full blur-2xl"></div>

      {/* Animated gradient orb - removed for performance */}

      {/* Scrollable content */}
      <div className="w-full relative z-10 pt-32 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1400px] mx-auto">
          {/* Hero Content */}
          <div
            className={`flex flex-col items-center text-center mb-8 transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
          >
            <div className="mb-0 max-w-5xl">
              {/* Super Sheets Badge - Above title */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 mb-4 sm:mb-5 bg-cyan-500/10 border border-cyan-500/30 rounded-full backdrop-blur-sm shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all duration-500 delay-75 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
              >
                <span className="text-cyan-400 text-lg animate-pulse">✨</span>
                <span className="text-xs font-semibold text-cyan-300 tracking-wide" style={{ lineHeight: dir === 'rtl' ? '1.6' : '1.4' }}>
                  {t.hero.superSheetsBadge}
                </span>
              </div>

              <h1
                className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-[var(--text-primary)] mb-4 sm:mb-6 leading-[1.2] tracking-tight transition-all duration-500 delay-75 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ lineHeight: dir === 'rtl' ? '1.3' : '1.2' }}
              >
                {t.hero.title}
              </h1>

              <p
                className={`text-base sm:text-lg md:text-xl lg:text-2xl text-[var(--text-secondary)] mb-6 sm:mb-8 leading-relaxed max-w-3xl mx-auto transition-all duration-500 delay-150 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                } ${dir === 'rtl' ? 'text-center' : 'text-center'}`}
                style={{ lineHeight: dir === 'rtl' ? '1.8' : '1.6' }}
                dangerouslySetInnerHTML={{
                  __html:
                    dir === 'rtl'
                      ? t.hero.subtitle.replace('غير محدود', '<span class="text-cyan-400 font-bold">غير محدود</span>')
                      : t.hero.subtitle.replace('unlimited', '<span class="text-cyan-400 font-bold">unlimited</span>')
                }}
              />

              {/* Social Proof Stats (hidden as requested) */}
              <div className="hidden"></div>

              <div
                className={`flex flex-col sm:flex-row gap-4 justify-center mb-4 transition-all duration-500 delay-300 ${
                  isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                }`}
              >
                <Button href="/register" size="lg">
                  {t.hero.cta}
                </Button>
              </div>
              <p
                className={`text-sm text-[var(--text-tertiary)] transition-all duration-500 delay-400 ${
                  isVisible ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ lineHeight: dir === 'rtl' ? '1.7' : '1.5' }}
              >
                ✓ {t.hero.noCreditCard}
              </p>
            </div>
          </div>

          {/* Inline Workflow Navigation (ARIA tabs) */}
          <div className="relative w-full mb-6">
            {/* Controls aligned on same row - visible only on mobile */}
            <button
              type="button"
              aria-label={dir === 'rtl' ? 'تبويب سابق' : 'Previous tab'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateToPrev(e);
              }}
              className="lg:hidden absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-black/70 text-cyan-300 border-2 border-cyan-500/50 flex items-center justify-center shadow-lg hover:bg-black/80 active:scale-95 z-30 transition-all"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={dir === 'rtl' ? 'تبويب لاحق' : 'Next tab'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateToNext(e);
              }}
              className="lg:hidden absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-black/70 text-cyan-300 border-2 border-cyan-500/50 flex items-center justify-center shadow-lg hover:bg-black/80 active:scale-95 z-30 transition-all"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
              </svg>
            </button>
            <div
              role="tablist"
              aria-label={t?.workflows?.ariaLabel ?? 'Workflows'}
              className="flex gap-2 overflow-x-hidden overflow-y-visible px-10 sm:px-12 md:px-8 lg:px-1 py-2 md:py-3 justify-center items-center min-h-[3rem]"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {workflows.map((label, idx) => (
                <button
                  key={idx}
                  role="tab"
                  aria-selected={activeIndex === idx}
                  aria-controls={`workflow-panel-${idx}`}
                  id={`workflow-tab-${idx}`}
                  tabIndex={activeIndex === idx ? 0 : -1}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveIndex(idx);
                  }}
                  className={`flex-shrink-0 whitespace-nowrap rounded-full border-2 bg-black/40 text-[var(--text-secondary)] hover:text-cyan-300 hover:border-cyan-500/60 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm md:text-base lg:px-5 lg:py-2.5 transition-all duration-500 min-h-[2.25rem] sm:min-h-[2.5rem] md:min-h-[2.75rem] flex items-center ${
                    activeIndex === idx
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/50 ring-2 ring-cyan-500/30 lg:scale-105 block opacity-100 translate-x-0'
                      : `border-cyan-500/30 ${
                          Math.abs(idx - activeIndex) <= 1
                            ? 'hidden sm:inline-flex opacity-60 hover:opacity-100'
                            : 'hidden lg:inline-flex opacity-60 hover:opacity-100'
                        }`
                  }`}
                  style={{ lineHeight: dir === 'rtl' ? '1.6' : '1.4' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Removed extra mobile-only controls; buttons now on same row */}
          </div>

          {/* Workflow Panel replacing GIF area, with typewriter title */}
          <div
            role="tabpanel"
            id={`workflow-panel-${activeIndex}`}
            aria-labelledby={`workflow-tab-${activeIndex}`}
            className="relative w-full mb-4 group"
          >
            {/* Glow (non-interactive to avoid blocking clicks) */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-purple-500/15 rounded-3xl blur-lg pointer-events-none"></div>

            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl bg-black/40 backdrop-blur-xl border-2 border-cyan-500/30 transition-all duration-300">
              <div className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-5">
                {/* Descriptions with typewriter effect */}
                <div
                  className={`text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-cyan-300 min-h-[2rem] sm:min-h-[2.5rem] md:min-h-[3rem] lg:min-h-[3.5rem] xl:min-h-[4rem] pb-1 px-2 ${
                    dir === 'rtl' ? 'text-right' : 'text-left'
                  }`}
                  dir={dir}
                  style={{
                    direction: dir === 'rtl' ? 'rtl' : 'ltr',
                    lineHeight: dir === 'rtl' ? '1.7' : '1.6',
                    textShadow: '0 0 20px rgba(6, 182, 212, 0.5)',
                    wordBreak: 'break-word'
                  }}
                >
                  <span className="inline-block" style={{ verticalAlign: 'baseline' }}>
                    {typedText}
                  </span>
                  {dir === 'rtl' ? (
                    <span
                      className="inline-block w-1.5 sm:w-2 h-5 sm:h-6 md:h-7 lg:h-8 bg-cyan-400 animate-pulse mr-1 sm:mr-1.5"
                      style={{ verticalAlign: 'baseline' }}
                      aria-hidden="true"
                    ></span>
                  ) : (
                    <span
                      className="inline-block w-1.5 sm:w-2 h-5 sm:h-6 md:h-7 lg:h-8 bg-cyan-400 animate-pulse ml-1 sm:ml-1.5"
                      style={{ verticalAlign: 'baseline' }}
                      aria-hidden="true"
                    ></span>
                  )}
                </div>

                <div className="mt-4 rounded-lg sm:rounded-xl overflow-hidden border border-cyan-500/20 relative">
                  {/* Loading spinner - only show initially */}
                  {isLoading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>
                        <span className="text-cyan-300 text-sm font-medium" style={{ lineHeight: dir === 'rtl' ? '1.7' : '1.5' }}>
                          {dir === 'rtl' ? 'جاري التحميل...' : 'Loading...'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Control buttons */}
                  <div className="absolute top-3 right-3 flex gap-2 z-10">
                    <button
                      onClick={restartGif}
                      type="button"
                      className="p-2 rounded-full bg-black/70 hover:bg-black/80 text-cyan-300 border border-cyan-500/50 transition-all hover:scale-110 active:scale-95 backdrop-blur-sm"
                      title={dir === 'rtl' ? 'إعادة من البداية' : 'Restart'}
                      aria-label={dir === 'rtl' ? 'إعادة من البداية' : 'Restart from beginning'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={togglePlayPause}
                      type="button"
                      className="p-2 rounded-full bg-black/70 hover:bg-black/80 text-cyan-300 border border-cyan-500/50 transition-all hover:scale-110 active:scale-95 backdrop-blur-sm"
                      title={isPaused ? (dir === 'rtl' ? 'تشغيل' : 'Play') : dir === 'rtl' ? 'إيقاف مؤقت' : 'Pause'}
                      aria-label={isPaused ? (dir === 'rtl' ? 'تشغيل' : 'Play') : dir === 'rtl' ? 'إيقاف مؤقت' : 'Pause'}
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

                  {/* Video container with lazy loading - only load current video */}
                  <div ref={containerRef} className="relative w-full">
                    {gifFiles.map((fileName, idx) => (
                      <video
                        key={idx}
                        ref={(el) => {
                          videoRefs.current[idx] = el;
                        }}
                        className="w-full h-auto transition-opacity duration-300"
                        loop
                        muted
                        playsInline
                        preload={activeIndex === idx ? 'auto' : 'none'}
                        style={{
                          opacity: activeIndex === idx ? 1 : 0,
                          position: activeIndex === idx ? 'relative' : 'absolute',
                          top: 0,
                          left: 0,
                          pointerEvents: activeIndex === idx ? 'auto' : 'none'
                        }}
                        onLoadedData={() => {
                          if (idx === activeIndex) setIsLoading(false);
                        }}
                        onCanPlay={() => {
                          if (idx === activeIndex) setIsLoading(false);
                        }}
                      >
                        <source src={`/hero_videos/${fileName.replace('.gif', '.mp4')}`} type="video/mp4" />
                      </video>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50 backdrop-blur-sm z-10">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-100 ease-linear"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative glow effects (non-interactive) */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-400 rounded-full opacity-30 blur-3xl pointer-events-none"></div>
            <div className="absolute top-0 left-0 w-40 h-40 bg-purple-500 rounded-full opacity-30 blur-3xl pointer-events-none"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
