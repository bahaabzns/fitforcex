"use client";

import { useLanguage } from "@/lib/landing/LanguageContext";
import Image from "next/image";

export default function TrustedBy() {
  const { t, dir } = useLanguage();

  // Duplicate logos for seamless infinite scroll
  const logos = [
    "/logos/Horizontal/Blue dark - H.png",
    "/logos/Horizontal/Blue dark - H.png",
    "/logos/Horizontal/Blue dark - H.png",
    "/logos/Horizontal/Blue dark - H.png",
    "/logos/Horizontal/Blue dark - H.png",
    "/logos/Horizontal/Blue dark - H.png",
  ];

  return (
    <section
      className="py-16 bg-gradient-to-b from-gray-50 to-white overflow-hidden"
      dir={dir}
    >
      <div className="section-container">
        <h3 className="text-center text-gray-500 text-sm font-semibold mb-12 uppercase tracking-wider">
          {t.trustedBy.title}
        </h3>
      </div>

      <div className="relative w-full overflow-hidden">
        <div
          className="flex items-center gap-16"
          style={{
            animation: "scroll-left 25s linear infinite",
          }}
        >
          {logos.map((logo, index) => (
            <div
              key={index}
              className="flex-shrink-0 grayscale hover:grayscale-0 transition-all duration-300"
            >
              <Image
                src={logo}
                alt="Company logo"
                width={140}
                height={50}
                style={{ width: "auto", height: "40px" }}
                className="object-contain"
              />
            </div>
          ))}
          {/* Duplicate for seamless loop */}
          {logos.map((logo, index) => (
            <div
              key={`duplicate-${index}`}
              className="flex-shrink-0 grayscale hover:grayscale-0 transition-all duration-300"
            >
              <Image
                src={logo}
                alt="Company logo"
                width={140}
                height={50}
                style={{ width: "auto", height: "40px" }}
                className="object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
