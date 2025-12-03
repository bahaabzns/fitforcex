'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/lib/landing/LanguageContext';
import LanguageToggle from './LanguageToggle';
import Button from './Button';

export default function Navbar() {
  const { t, dir } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      // Throttle scroll events to improve performance
      if (throttleTimerRef.current) return;

      throttleTimerRef.current = setTimeout(() => {
        setIsScrolled(window.scrollY > 10);
        throttleTimerRef.current = null;
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    };
  }, []);

  const navItems = [
    { label: t.nav.features, href: '#features' },
    { label: t.nav.demo, href: '#demo' },
    { label: t.nav.coaches, href: '#coaches' },
    { label: t.nav.pricing, href: '#pricing' },
    { label: t.nav.faq, href: '#faq' }
  ];

  const handleNavItemClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-cyan-500/30 shadow-lg shadow-cyan-500/10'
          : 'bg-[var(--bg-primary)]/40 backdrop-blur-md border-b border-cyan-500/10'
      }`}
      dir={dir}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center relative group z-10">
            <Image
              src="/logos/Horizontal/gradient white - H.png"
              alt="FitForce"
              width={150}
              height={40}
              className="h-8 md:h-10 w-auto group-hover:brightness-110 transition-all duration-300 group-hover:scale-105"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-gray-300 hover:text-cyan-400 font-medium transition-all duration-300 relative group focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded px-2 py-1"
              >
                {item.label}
                <span
                  className={`absolute bottom-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 group-hover:w-full transition-all duration-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] w-0 ${dir === 'rtl' ? 'right-0' : 'left-0'}`}
                ></span>
              </a>
            ))}
          </div>

          {/* Right Side */}
          <div className="hidden lg:flex items-center gap-4">
            <LanguageToggle />
            <Link
              href="/login"
              className="text-gray-300 hover:text-cyan-400 font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded px-2 py-1"
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
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isMobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-[var(--bg-primary)]/95 backdrop-blur-xl border-t border-cyan-500/20 py-4 px-4 space-y-3">
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
              <Link href="/login" onClick={handleNavItemClick} className="block text-gray-300 hover:text-cyan-400 px-4 py-2">
                {t.nav.login}
              </Link>
              <Button href="/register" onClick={handleNavItemClick} fullWidth>
                {t.nav.getStarted}
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
