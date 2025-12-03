'use client';

import dynamic from "next/dynamic";
import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import { LanguageProvider } from "@/lib/landing/LanguageContext";

// Lazy load below-fold components
const FeatureSection = dynamic(() => import("./FeatureSection"), {
  loading: () => <div className="min-h-screen" />,
});
const Slideshow = dynamic(() => import("./Slideshow"), {
  loading: () => <div className="min-h-screen" />,
});
const Pricing = dynamic(() => import("./Pricing"), {
  loading: () => <div className="min-h-screen" />,
});
const FoundersWord = dynamic(() => import("./FoundersWord"), {
  loading: () => <div className="min-h-screen" />,
});
const FAQ = dynamic(() => import("./FAQ"), {
  loading: () => <div className="min-h-screen" />,
});
const ScrollToTop = dynamic(() => import("./ScrollToTop"));
const WhatsAppButton = dynamic(() => import("./WhatsAppButton"));
const Footer = dynamic(() => import("./Footer"));

export default function NewLandingPage() {
  return (
    <LanguageProvider>
      <main className="scroll-snap-container w-full max-w-[100vw] overflow-x-hidden">
      <Navbar />
      {/* Section 1: Combined Hero + Full GIF + Trusted By (free scrolling) */}
      <HeroSection />

      {/* Section 2: Trusted By Coaches */}
      {/* <TrustedBy /> */}

      {/* Sections 3-8: Individual Feature Sections */}
      <div id="features">
        <FeatureSection featureKey="feature1" screenshot="/unlimited.png" />

        <FeatureSection featureKey="feature2" screenshot="/Untitled-1.png" />

        <FeatureSection featureKey="feature3" screenshot="/delivery.png" />

        <FeatureSection featureKey="feature4" screenshot="/library.png" />

        <FeatureSection
          featureKey="feature5"
          screenshot="/Client Progress Tracking.png"
        />

        <FeatureSection featureKey="feature6" screenshot="/EasyToUse.png" />
      </div>

      {/* Section 11: Slideshow */}
      <Slideshow />

      {/* Section 13: Pricing */}
      <Pricing />

      {/* Section 12: Founder's Guarantee */}
      <FoundersWord />

      {/* Section 14: FAQ */}
      <FAQ />

      <ScrollToTop />
      <WhatsAppButton />
      <Footer />
    </main>
    </LanguageProvider>
  );
}
