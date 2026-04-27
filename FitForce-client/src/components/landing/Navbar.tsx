"use client";

import { useState, useCallback, memo } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/landing/LanguageContext";
import LanguageToggle from "./LanguageToggle";
import Button from "./Button";

function Navbar() {
  const { t, dir } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoSrc, setLogoSrc] = useState("/logos/Horizontal/gradient white - H.svg");
  const [logoLoaded, setLogoLoaded] = useState(false);

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  }, []);

  // Handle logo loading with fallback
  const handleLogoLoad = useCallback(() => {
    setLogoLoaded(true);
  }, []);

  const handleLogoError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    // Try PNG fallback
    if (target.src.includes('.svg')) {
      setLogoSrc("/logos/Horizontal/gradient white - H.png");
    } else if (target.src.includes('Horizontal')) {
      // Try root level fallback
      setLogoSrc("/logos/gradient white - H.png");
    } else {
      // Last resort: use a simple text logo
      console.warn("Logo failed to load, using text fallback");
    }
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[2000] bg-black/85 backdrop-blur-xl border-b border-cyan-500/30 shadow-lg shadow-cyan-500/10 ${
        dir === "rtl" ? "rtl-navbar" : ""
      }`}
      dir={dir}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo Section - Completely rebuilt */}
          <div className="flex items-center flex-shrink-0">
            <button
              type="button"
              onClick={scrollToTop}
              className="flex items-center justify-center relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded transition-all duration-300 hover:scale-105"
              aria-label="FitForce Logo - Go to top"
            >
              {/* Logo Image with multiple fallbacks */}
              <div className="relative w-full h-full">
                <img
                  src={logoSrc}
                  alt="FitForce"
                  onLoad={handleLogoLoad}
                  onError={handleLogoError}
                  className="h-10 md:h-12 lg:h-14 w-auto max-w-[180px] md:max-w-[200px] lg:max-w-[220px] object-contain transition-all duration-300 group-hover:brightness-110"
                  style={{
                    display: 'block',
                    opacity: logoLoaded ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out',
                    minWidth: '120px',
                    minHeight: '32px',
                  }}
                />
                {/* Loading placeholder - shows until image loads */}
                {!logoLoaded && (
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{
                      minWidth: '120px',
                      minHeight: '32px',
                    }}
                  >
                    <span className="text-cyan-400 font-bold text-lg md:text-xl">FitForce</span>
                  </div>
                )}
              </div>
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-5 xl:gap-6 mx-6 xl:mx-8 flex-1 justify-center">
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

          {/* Right Side - Desktop */}
          <div className="hidden lg:flex items-center gap-4 ml-6 xl:ml-8 flex-shrink-0">
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
            type="button"
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
              xmlns="http://www.w3.org/2000/svg"
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
