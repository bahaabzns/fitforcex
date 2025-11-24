'use client';

import Navbar from './Navbar';
import HeroSection from './HeroSection';
import FeatureSection from './FeatureSection';
import QuickDemo from './QuickDemo';
import Pricing from './Pricing';
import Coaches from './Coaches';
import FAQ from './FAQ';
import ScrollToTop from './ScrollToTop';
import Footer from './Footer';
import { LanguageProvider } from '@/lib/landing/LanguageContext';

export default function NewLandingPage() {
  return (
    <LanguageProvider>
      <main className="scroll-snap-container w-full max-w-[100vw] overflow-x-hidden">
        <Navbar />
        {/* Section 1: Combined Hero + Full GIF + Trusted By (free scrolling) */}
        <HeroSection />

        {/* Sections 3-8: Individual Feature Sections */}
        <div id="features">
          <FeatureSection
            featureKey="feature1"
            screenshot="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=450&fit=crop&q=80&fm=webp"
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
          />

          <FeatureSection
            featureKey="feature2"
            screenshot="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=450&fit=crop&q=80&fm=webp"
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />

          <FeatureSection
            featureKey="feature3"
            screenshot="https://images.unsplash.com/photo-1551434678-e076c223a692?w=600&h=450&fit=crop&q=80&fm=webp"
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
          />

          <FeatureSection
            featureKey="feature4"
            screenshot="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&h=450&fit=crop&q=80&fm=webp"
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            }
          />

          <FeatureSection
            featureKey="feature5"
            screenshot="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=450&fit=crop&q=80&fm=webp"
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            }
          />

          <FeatureSection
            featureKey="feature6"
            screenshot="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&h=450&fit=crop&q=80&fm=webp"
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
        </div>

        {/* Section 9: Quick Demo */}
        <QuickDemo />

        {/* Section 10: Coaches */}
        <Coaches />

        {/* Section 11: Pricing */}
        <Pricing />

        {/* Section 12: FAQ */}
        <FAQ />

        <ScrollToTop />
        <Footer />
      </main>
    </LanguageProvider>
  );
}
