"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useLanguage } from "@/lib/landing/LanguageContext";
import { useScrollAnimation } from "@/lib/landing/useScrollAnimation";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

// Coaches data
const coaches = [
  {
    id: 1,
    name: "Ahmed Elbasuony",
    image: "/basuo 3.png",
    description:
      "First Egyptian WNBF competitor and judge. From overweight teen to bodybuilding champion, now helping others achieve their wellness goals.",
    instagram: {
      username: "@elbasuony87",
      url: "https://www.instagram.com/elbasuony87/",
      followers: "131K",
    },
  },
  {
    id: 2,
    name: "Abdallah Gamal",
    image: "/agamal.png",
    description:
      "Medical doctor and WNBF natural athlete with 2000+ clients worldwide. Former IGCSE teacher and cardiology assistant bringing simple, flexible plans.",
    instagram: {
      username: "@abdallahgamall_",
      url: "https://www.instagram.com/abdallahgamall_/",
      followers: "428K",
    },
  },
  // {
  //   id: 3,
  //   name: "Shady Tarek",
  //   image: "/shady.png",
  //   description:
  //     "Your fitness brother, not just a coach. Dedicated to improving online coaching in Egypt and helping you reach your goals faster with proven methods.",
  //   instagram: {
  //     username: "@shaadytarek",
  //     url: "https://www.instagram.com/shaadytarek/",
  //     followers: "59.4K",
  //   },
  // },
];

export default function Slideshow() {
  const { t, dir } = useLanguage();

  // Coaches data with translations
  const coaches = [
    {
      id: 1,
      name: t?.coaches?.coach1?.name || "Ahmed Elbasuony",
      image: "/basuo 3.png",
      description:
        t?.coaches?.coach1?.description ||
        "First Egyptian WNBF competitor and judge. From overweight teen to bodybuilding champion, now helping others achieve their wellness goals.",
      instagram: {
        username: "@elbasuony87",
        url: "https://www.instagram.com/elbasuony87/",
        followers: "131K",
      },
    },
    {
      id: 2,
      name: t?.coaches?.coach2?.name || "Abdallah Gamal",
      image: "/agamal.png",
      description:
        t?.coaches?.coach2?.description ||
        "Medical doctor and WNBF natural athlete with 2000+ clients worldwide. Former IGCSE teacher and cardiology assistant bringing simple, flexible plans.",
      instagram: {
        username: "@abdallahgamall_",
        url: "https://www.instagram.com/abdallahgamall_/",
        followers: "428K",
      },
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const sectionRef = useScrollAnimation();

  // Auto-play functionality
  useEffect(() => {
    const autoPlayInterval = setInterval(() => {
      if (!isTransitioning && !isHovering) {
        setIsTransitioning(true);
        setCurrentIndex((prev) => (prev === coaches.length - 1 ? 0 : prev + 1));
        setTimeout(() => setIsTransitioning(false), 800);
      }
    }, 5000);

    return () => clearInterval(autoPlayInterval);
  }, [isTransitioning, isHovering, coaches.length]);

  const goToPrevious = () => {
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev === 0 ? coaches.length - 1 : prev - 1));
    setTimeout(() => setIsTransitioning(false), 800);
  };

  const goToNext = () => {
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev === coaches.length - 1 ? 0 : prev + 1));
    setTimeout(() => setIsTransitioning(false), 800);
  };

  const goToSlide = (index: number) => {
    if (index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 800);
  };

  // Generate all coach cards with proper positioning
  const renderCoachCards = () => {
    const total = coaches.length;

    return coaches.map((coach, index) => {
      // Calculate relative position to current index
      let position = index - currentIndex;

      // Handle circular wrapping
      if (position > total / 2) position -= total;
      if (position < -total / 2) position += total;

      // Determine visibility and styling
      const isCenter = position === 0;
      const isAdjacent = Math.abs(position) === 1;
      const isVisible = Math.abs(position) <= 2; // Render 2 positions out for smooth entrance

      if (!isVisible) return null;

      // Calculate translation based on position and direction
      const baseOffset = 340;
      let translateX = position * baseOffset;
      if (dir === "rtl") translateX = -translateX;

      // Enhanced styling with smooth curves
      let scale, opacity, blur, brightness, translateY;

      if (isCenter) {
        scale = 1;
        opacity = 1;
        blur = 0;
        brightness = 1;
        translateY = 0;
      } else if (isAdjacent) {
        scale = 0.7;
        opacity = 0.25;
        blur = 2;
        brightness = 0.7;
        translateY = 20;
      } else {
        // Cards further out (preparing to enter)
        scale = 0.5;
        opacity = 0;
        blur = 4;
        brightness = 0.5;
        translateY = 40;
      }

      const zIndex = isCenter ? 30 : isAdjacent ? 10 : 5;

      return (
        <div
          key={coach.id}
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translateX(${translateX}px) translateY(${translateY}px) scale(${scale})`,
            opacity,
            filter: `blur(${blur}px) brightness(${brightness})`,
            transition:
              "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), filter 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
            zIndex,
            pointerEvents: isCenter ? "auto" : "none",
          }}
        >
          <div className="relative w-[280px] h-[400px] md:w-[320px] md:h-[450px] lg:w-[350px] lg:h-[500px]">
            <Image
              src={coach.image}
              alt={coach.name}
              fill
              className="object-cover rounded-2xl"
              style={{
                filter: isCenter
                  ? "drop-shadow(0 25px 70px rgba(6, 182, 212, 0.4)) drop-shadow(0 10px 30px rgba(6, 182, 212, 0.3))"
                  : "none",
                transition: "filter 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
              sizes="(max-width: 768px) 280px, (max-width: 1024px) 320px, 350px"
              priority={isCenter || isAdjacent}
            />

            {/* Coach Info Overlay - Visible on all cards with slide-up animation */}
            <div
              className="absolute bottom-0 left-0 right-0 p-4 md:p-5 lg:p-6 backdrop-blur-xl bg-gradient-to-t from-black/90 via-black/70 to-transparent border-t border-cyan-500/30 rounded-b-2xl overflow-hidden"
              style={{
                transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 to-transparent rounded-b-2xl"></div>

              <div
                className="relative z-10 space-y-2 md:space-y-3"
                style={{
                  transform: isCenter ? "translateY(0)" : "translateY(20px)",
                  opacity: isCenter ? 1 : 0.6,
                  transition:
                    "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                {/* Coach Name with slide-up animation */}
                <h3
                  className="text-xl md:text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                  style={{
                    transform: isCenter ? "translateY(0)" : "translateY(10px)",
                    opacity: isCenter ? 1 : 0,
                    transition:
                      "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s, opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s",
                  }}
                >
                  {coach.name}
                </h3>

                {/* Description with slide-up animation */}
                <p
                  className="text-xs md:text-sm text-gray-300 leading-relaxed"
                  style={{
                    transform: isCenter ? "translateY(0)" : "translateY(10px)",
                    opacity: isCenter ? 1 : 0,
                    transition:
                      "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s, opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s",
                  }}
                >
                  {coach.description}
                </p>

                {/* Instagram Info with slide-up animation */}
                <a
                  href={coach.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-cyan-500/15 to-blue-500/15 hover:from-cyan-500/25 hover:to-blue-500/25 rounded-lg transition-all duration-300 hover:scale-105 group border border-cyan-500/30 hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                  aria-label={`Instagram ${coach.instagram.username}`}
                  style={{
                    transform: isCenter ? "translateY(0)" : "translateY(10px)",
                    opacity: isCenter ? 1 : 0,
                    transition:
                      "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.3s, opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.3s",
                  }}
                >
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-xs md:text-sm font-semibold text-cyan-300 group-hover:text-cyan-200 transition-colors">
                      {coach.instagram.username}
                    </span>
                    <span className="text-[10px] md:text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                      {coach.instagram.followers} followers
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <section
      id="slideshow"
      className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] relative scroll-snap-section scroll-snap-center overflow-hidden py-16 md:py-20"
      dir={dir}
      ref={sectionRef}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-black to-[var(--bg-primary)]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-cyan-500/8 to-blue-600/8 rounded-full blur-3xl"></div>

      <div className="w-full relative z-10">
        <div className="section-container">
          {/* Title */}
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4">
              {t?.trustedBy?.title || "Trusted by Top-Tier Coaches"}
            </h2>
            <p className="text-lg md:text-xl text-gray-400">
              {t?.coaches?.subtitle || ""}
            </p>
          </div>

          {/* Slideshow Container */}
          <div
            className="relative flex items-center justify-center px-4 md:px-8"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            {/* Coaches Display */}
            <div className="relative w-full max-w-7xl h-[400px] md:h-[450px] lg:h-[500px]">
              {renderCoachCards()}
            </div>

            {/* Navigation Arrows - Desktop */}
            <button
              onClick={goToPrevious}
              className={`hidden md:flex absolute ${
                dir === "rtl" ? "right-0 lg:right-4" : "left-0 lg:left-4"
              } z-40 p-3 lg:p-4 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 backdrop-blur-md rounded-full hover:from-cyan-500/30 hover:to-blue-600/30 transition-all duration-300 hover:scale-110 group border border-cyan-500/30`}
              aria-label={dir === "rtl" ? "المدرب التالي" : "Previous coach"}
            >
              {dir === "rtl" ? (
                <ChevronRightIcon className="!w-6 !h-6 lg:!w-8 lg:!h-8 text-white group-hover:text-cyan-400 transition-colors" />
              ) : (
                <ChevronLeftIcon className="!w-6 !h-6 lg:!w-8 lg:!h-8 text-white group-hover:text-cyan-400 transition-colors" />
              )}
            </button>

            <button
              onClick={goToNext}
              className={`hidden md:flex absolute ${
                dir === "rtl" ? "left-0 lg:left-4" : "right-0 lg:right-4"
              } z-40 p-3 lg:p-4 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 backdrop-blur-md rounded-full hover:from-cyan-500/30 hover:to-blue-600/30 transition-all duration-300 hover:scale-110 group border border-cyan-500/30`}
              aria-label={dir === "rtl" ? "المدرب السابق" : "Next coach"}
            >
              {dir === "rtl" ? (
                <ChevronLeftIcon className="!w-6 !h-6 lg:!w-8 lg:!h-8 text-white group-hover:text-cyan-400 transition-colors" />
              ) : (
                <ChevronRightIcon className="!w-6 !h-6 lg:!w-8 lg:!h-8 text-white group-hover:text-cyan-400 transition-colors" />
              )}
            </button>
          </div>

          {/* Navigation Arrows - Mobile */}
          <div className="flex md:hidden items-center justify-center gap-4 mt-4">
            <button
              onClick={goToPrevious}
              className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 backdrop-blur-md rounded-full active:scale-95 transition-all duration-300 border border-cyan-500/30"
              aria-label={dir === "rtl" ? "المدرب التالي" : "Previous coach"}
            >
              {dir === "rtl" ? (
                <ChevronRightIcon className="!w-6 !h-6 text-white" />
              ) : (
                <ChevronLeftIcon className="!w-6 !h-6 text-white" />
              )}
            </button>

            <button
              onClick={goToNext}
              className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 backdrop-blur-md rounded-full active:scale-95 transition-all duration-300 border border-cyan-500/30"
              aria-label={dir === "rtl" ? "المدرب السابق" : "Next coach"}
            >
              {dir === "rtl" ? (
                <ChevronLeftIcon className="!w-6 !h-6 text-white" />
              ) : (
                <ChevronRightIcon className="!w-6 !h-6 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
