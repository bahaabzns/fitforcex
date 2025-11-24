'use client';
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import { useLanguage } from '@/lib/landing/LanguageContext';
import Image from 'next/image';

export default function FullDemo() {
  const { t, dir } = useLanguage();
  const [isPaused, setIsPaused] = useState(false);
  const [gifSrc, setGifSrc] = useState('/demo.gif');

  const togglePause = () => {
    if (isPaused) {
      setGifSrc('/demo.gif?t=' + new Date().getTime());
      setIsPaused(false);
    } else {
      const img = document.getElementById('full-demo-gif') as HTMLImageElement;
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

  const logos = [
    '/logos/Horizontal/Blue dark - H.png',
    '/logos/Horizontal/Dark - H.png',
    '/logos/Horizontal/Gradient dark - H.png',
    '/logos/Horizontal/Blue dark - H.png',
    '/logos/Horizontal/Dark - H.png',
    '/logos/Horizontal/Gradient dark - H.png'
  ];

  return (
    <section className="min-h-screen flex items-center scroll-snap-align-start bg-black relative overflow-hidden" dir={dir}>
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950 to-black"></div>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-gradient-to-r from-cyan-500/20 via-blue-600/15 to-purple-700/10 rounded-full blur-3xl"></div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 relative z-10">
        <div className="flex flex-col gap-12">
          {/* Full GIF Display */}
          <div className="relative w-full">
            {/* Outer neon glow */}
            <div className="absolute -inset-6 bg-gradient-to-r from-cyan-500/30 via-blue-500/30 to-purple-500/30 rounded-3xl blur-2xl"></div>

            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-black/40 backdrop-blur-xl border-2 border-cyan-500/30">
              <img id="full-demo-gif" src={gifSrc} alt="FitForce Platform Full Demo" className="w-full h-auto" />
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
          </div>

          {/* Trusted By Section */}
          <div className="bg-gray-900/30 backdrop-blur-lg border border-cyan-500/20 rounded-2xl p-8 overflow-hidden shadow-lg shadow-cyan-500/10">
            <h3 className="text-center text-gray-300 font-semibold mb-8 text-xl">{t.trustedBy.title}</h3>
            <div className="relative w-full overflow-hidden">
              {/* Gradient overlays for fade effect */}
              <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-gray-900/80 to-transparent z-10"></div>
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-gray-900/80 to-transparent z-10"></div>

              <div
                className="flex items-center gap-16"
                style={{
                  animation: 'scroll-left 25s linear infinite'
                }}
              >
                {logos.map((logo, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 grayscale hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100"
                  >
                    <Image
                      src={logo}
                      alt="Company logo"
                      width={140}
                      height={50}
                      style={{ width: 'auto', height: '40px' }}
                      className="object-contain brightness-200"
                    />
                  </div>
                ))}
                {/* Duplicate for seamless loop */}
                {logos.map((logo, index) => (
                  <div
                    key={`duplicate-${index}`}
                    className="flex-shrink-0 grayscale hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100"
                  >
                    <Image
                      src={logo}
                      alt="Company logo"
                      width={140}
                      height={50}
                      style={{ width: 'auto', height: '40px' }}
                      className="object-contain brightness-200"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
