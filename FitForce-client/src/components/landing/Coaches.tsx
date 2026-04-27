'use client';

import { useLanguage } from '@/lib/landing/LanguageContext';
import { useRef, useState, useEffect } from 'react';
import { useScrollAnimation } from '@/lib/landing/useScrollAnimation';
import Image from 'next/image';

export default function Coaches() {
  const { t, dir } = useLanguage();
  const [currentCoachIndex, setCurrentCoachIndex] = useState(0);
  const [isAutoplay, setIsAutoplay] = useState(true);
  const headerRef = useScrollAnimation();
  const autoplayTimerRef = useRef<NodeJS.Timeout>();

  const coaches = [
    {
      name: 'Basuony',
      title: 'Fitness Coach',
      specialty: 'Strength Training',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=500&fit=crop',
      testimonial:
        'With 15+ years of experience in fitness, I help clients achieve their goals through personalized strength training programs designed for their unique needs.'
    },
    {
      name: 'Abdullah Gamal',
      title: 'Nutrition Expert',
      specialty: 'Sports Nutrition',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop',
      testimonial:
        'Nutrition is the foundation of fitness. I guide clients towards sustainable eating habits that fuel their body and enhance athletic performance.'
    },
    {
      name: 'Shady Tarek',
      title: 'Strength Coach',
      specialty: 'Powerlifting',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop',
      testimonial:
        "Powerlifting transformed my life, and now I'm passionate about helping others unlock their true strength potential through proper technique and progressive training."
    },
    {
      name: 'Sarah Ahmed',
      title: 'Yoga Instructor',
      specialty: 'Flexibility & Wellness',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=500&fit=crop',
      testimonial:
        "Yoga is more than exercise; it's a journey to inner peace and physical balance. I create a safe space for clients to explore their flexibility and wellness."
    },
    {
      name: 'Mohamed Hassan',
      title: 'CrossFit Coach',
      specialty: 'Functional Fitness',
      image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=500&fit=crop',
      testimonial:
        'CrossFit teaches resilience, community, and functional strength. I empower my clients to become stronger, faster, and more confident in every aspect of life.'
    },
    {
      name: 'Nour Ali',
      title: 'Personal Trainer',
      specialty: 'Weight Loss',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop',
      testimonial:
        'Weight loss is a journey, not a destination. I combine science-backed training methods with motivation and accountability to help clients achieve lasting results.'
    }
  ];

  // Auto-advance slideshow
  useEffect(() => {
    if (isAutoplay) {
      autoplayTimerRef.current = setInterval(() => {
        setCurrentCoachIndex((prev) => (prev + 1) % coaches.length);
      }, 5000);
    }
    return () => {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
      }
    };
  }, [isAutoplay, coaches.length]);

  const goToNext = () => {
    setIsAutoplay(false);
    setCurrentCoachIndex((prev) => (prev + 1) % coaches.length);
    setIsAutoplay(true);
  };

  const goToPrev = () => {
    setIsAutoplay(false);
    setCurrentCoachIndex((prev) => (prev - 1 + coaches.length) % coaches.length);
    setIsAutoplay(true);
  };

  return (
    <section
      id="coaches"
      className="min-h-screen flex items-center bg-[var(--bg-primary)] relative scroll-snap-section scroll-snap-center overflow-hidden py-16 md:py-20"
      dir={dir}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)]"></div>
      <div className="absolute top-1/3 right-1/3 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/6 to-blue-600/6 rounded-full blur-2xl"></div>

      <div className="w-full h-full relative z-10 flex flex-col py-4">
        {/* Header */}
        <div ref={headerRef} className="text-center mb-4 pt-4 animate-on-scroll fade-in-up">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-[var(--text-primary)] mb-2 tracking-tight">{t.coaches.title}</h2>
          <p className="text-base md:text-lg text-[var(--text-secondary)] mb-2">{t.coaches.subtitle}</p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-full">
            <span className="text-xs md:text-sm text-cyan-400 font-semibold">✨ Join 10,000+ successful coaches like them</span>
          </div>
        </div>

        {/* Slideshow Container */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative">
          <div className="w-full max-w-6xl relative">
            {/* Slides */}
            <div className="relative min-h-[350px] md:min-h-[450px] lg:min-h-[500px]">
              {coaches.map((coach, index) => {
                const isActive = index === currentCoachIndex;

                return (
                  <div
                    key={coach.name}
                    className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                      isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    }`}
                  >
                    {/* Main Coach Display */}
                    <div
                      className={`flex flex-col md:flex-row items-center gap-4 md:gap-6 lg:gap-10 min-h-[350px] md:min-h-[450px] lg:min-h-[500px] ${dir === 'rtl' ? 'md:flex-row-reverse' : ''}`}
                    >
                      {/* Image Section */}
                      <div className="w-full md:flex-1 relative group flex items-center justify-center px-4">
                        {/* Glow effect */}
                        <div
                          className={`absolute inset-0 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 blur-3xl rounded-3xl transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                        ></div>

                        {/* Coach Image */}
                        <div
                          className={`relative w-full max-w-[180px] sm:max-w-[200px] md:max-w-[280px] lg:max-w-sm aspect-[4/5] flex items-center justify-center transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                        >
                          <Image
                            src={coach.image}
                            alt={coach.name}
                            width={400}
                            height={500}
                            priority={isActive}
                            className="w-full h-full object-cover rounded-2xl md:rounded-3xl shadow-2xl shadow-cyan-500/50"
                          />
                        </div>
                      </div>

                      {/* Info Section */}
                      <div className="w-full md:flex-1 flex flex-col justify-center text-center md:text-left">
                        {/* Name */}
                        <h3
                          className={`font-black text-cyan-400 mb-1 md:mb-2 tracking-tight text-2xl md:text-3xl lg:text-4xl transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                        >
                          {coach.name}
                        </h3>

                        {/* Title with accent box */}
                        <div
                          className={`inline-block mx-auto md:mx-0 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border border-cyan-500/40 rounded-lg px-3 py-1.5 mb-2 md:mb-3 w-fit transition-opacity duration-500 delay-75 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                        >
                          <p className="text-sm md:text-base lg:text-lg font-bold text-cyan-300">{coach.title}</p>
                        </div>

                        {/* Specialty */}
                        <p
                          className={`text-gray-300/70 text-xs md:text-sm lg:text-base mb-2 md:mb-3 font-semibold transition-opacity duration-500 delay-100 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                        >
                          {coach.specialty}
                        </p>

                        {/* Testimonial */}
                        <p
                          className={`text-gray-300 text-xs md:text-sm lg:text-base leading-relaxed italic border-l-4 border-cyan-400/50 pl-2 md:pl-3 mx-auto md:mx-0 max-w-xl transition-opacity duration-500 delay-150 ${isActive ? 'opacity-100' : 'opacity-0'} ${dir === 'rtl' ? 'border-l-0 border-r-4 pl-0 pr-2 md:pr-3' : ''}`}
                        >
                          &ldquo;{coach.testimonial}&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Previous/Next buttons - responsive positioning */}
            <button
              onClick={goToPrev}
              className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 lg:-translate-x-20 z-20 bg-gray-900/80 backdrop-blur-xl border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 rounded-full p-3 lg:p-4 shadow-lg shadow-cyan-500/20 transition-all hover:scale-110 hover:shadow-cyan-500/40 hover:bg-gray-900/90"
              aria-label="Previous coach"
            >
              <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dir === 'rtl' ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
              </svg>
            </button>

            <button
              onClick={goToNext}
              className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 lg:translate-x-20 z-20 bg-gray-900/80 backdrop-blur-xl border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 rounded-full p-3 lg:p-4 shadow-lg shadow-cyan-500/20 transition-all hover:scale-110 hover:shadow-cyan-500/40 hover:bg-gray-900/90"
              aria-label="Next coach"
            >
              <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dir === 'rtl' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
              </svg>
            </button>
          </div>
        </div>

        {/* Coach count indicator */}
        <div className="text-center pb-4 md:pb-6 text-gray-400 flex-shrink-0">
          <span className="text-xs md:text-sm font-semibold">
            {currentCoachIndex + 1} / {coaches.length}
          </span>
        </div>
      </div>
    </section>
  );
}
