"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/lib/landing/LanguageContext";
import LanguageToggle from "./LanguageToggle";
import Button from "./Button";

function Navbar() {
  const { t, dir } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const mainElement = document.querySelector("main");
    if (!mainElement) return;

    const handleScroll = () => {
      // Throttle scroll events to improve performance
      if (throttleTimerRef.current) return;

      throttleTimerRef.current = setTimeout(() => {
        setIsScrolled(mainElement.scrollTop > 10);
        throttleTimerRef.current = null;
      }, 100);
    };

    mainElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      mainElement.removeEventListener("scroll", handleScroll);
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    };
  }, []);

  const navItems = [
    { label: t.nav.features, href: "#features" },
    { label: t.nav.coaches, href: "#slideshow" },
    { label: t.nav.pricing, href: "#pricing" },
    { label: t.foundersword?.title || t.nav.demo, href: "#foundersword" },
    { label: t.nav.faq, href: "#faq" },
  ];

  const handleNavItemClick = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const scrollToTop = useCallback(() => {
    const mainElement = document.querySelector("main");
    if (mainElement) {
      mainElement.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-cyan-500/30 shadow-lg shadow-cyan-500/10"
          : "bg-[var(--bg-primary)]/40 backdrop-blur-md border-b border-cyan-500/10"
      } ${dir === "rtl" ? "rtl-navbar" : ""}`}
      dir={dir}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <button
            onClick={scrollToTop}
            className="flex items-center relative group z-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded"
          >
            <Image
              src="/logos/Horizontal/gradient white - H.svg"
              alt="FitForce"
              width={180}
              height={48}
              className="h-10 md:h-12 w-auto group-hover:brightness-110 transition-all duration-300 group-hover:scale-105"
              priority
            />
          </button>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-5 xl:gap-6 mx-6 xl:mx-8">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-gray-300 hover:text-cyan-400 font-medium transition-all duration-300 relative group focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded px-2 py-1 whitespace-nowrap"
              >
                {item.label}
                <span
                  className={`absolute bottom-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 group-hover:w-full transition-all duration-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] w-0 ${
                    dir === "rtl" ? "right-0" : "left-0"
                  }`}
                ></span>
              </a>
            ))}
          </div>

          {/* Right Side */}
          <div className="hidden lg:flex items-center gap-4 ml-6 xl:ml-8">
            <LanguageToggle />
            <Link
              href="/login"
              className="text-gray-300 hover:text-cyan-400 font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded px-2 py-1 whitespace-nowrap"
            >
              {t.nav.login}
            </Link>
            <Button href="/register" size="md">
              {t.nav.getStarted}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden z-10 p-2 rounded-lg hover:bg-gray-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  isMobileMenuOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M4 6h16M4 12h16M4 18h16"
                }
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-[var(--bg-primary)]/95 backdrop-blur-xl border-t border-cyan-500/20 py-4 px-4 space-y-3 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={handleNavItemClick}
                className="block text-gray-300 hover:text-cyan-400 hover:bg-gray-900/50 px-4 py-2 rounded transition-all duration-300"
              >
                {item.label}
              </a>
            ))}
            <div className="border-t border-cyan-500/10 pt-3 space-y-3">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-gray-400">{t.nav.language}</span>
                <LanguageToggle />
              </div>
              <Link
                href="/login"
                onClick={handleNavItemClick}
                className="block text-gray-300 hover:text-cyan-400 px-4 py-2"
              >
                {t.nav.login}
              </Link>
              <Link href="/register" onClick={handleNavItemClick}>
                <Button fullWidth>{t.nav.getStarted}</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default memo(Navbar);
