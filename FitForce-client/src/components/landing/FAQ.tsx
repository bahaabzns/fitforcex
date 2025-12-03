"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/landing/LanguageContext";

export default function FAQ() {
  const { t, dir } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    { question: t.faq.q1.question, answer: t.faq.q1.answer },
    { question: t.faq.q2.question, answer: t.faq.q2.answer },
    { question: t.faq.q3.question, answer: t.faq.q3.answer },
    { question: t.faq.q4.question, answer: t.faq.q4.answer },
    // { question: t.faq.q5.question, answer: t.faq.q5.answer },
    { question: t.faq.q6.question, answer: t.faq.q6.answer },
    { question: t.faq.q7.question, answer: t.faq.q7.answer },
    { question: t.faq.q8.question, answer: t.faq.q8.answer },
  ];

  return (
    <section
      id="faq"
      className="min-h-screen bg-[var(--bg-primary)] relative scroll-snap-section scroll-snap-start overflow-hidden py-20 md:py-24"
      dir={dir}
    >
      {/* Optimized background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)]"></div>
      <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-to-r from-cyan-500/8 to-blue-600/8 rounded-full blur-2xl"></div>

      <div className="section-container w-full relative z-10">
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-[var(--text-primary)] mb-2 md:mb-3 tracking-tight">
            {t.faq.title}
          </h2>
          <p className="text-base md:text-lg text-[var(--text-secondary)] mb-2 md:mb-3">
            {t.faq.subtitle}
          </p>
          <div className="inline-flex items-center gap-2 text-cyan-400 text-xs md:text-sm">
            <svg
              className="w-4 h-4 md:w-5 md:h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              {t?.faq?.stillHaveQuestions ??
                (dir === "rtl"
                  ? "لسه عندك أسئلة؟ تواصل مع فريقنا →"
                  : "Still have questions? Chat with our team →")}
            </span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-2 md:px-0">
          <div className="space-y-3 md:space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-cyan-500/20 rounded-lg overflow-hidden bg-gray-900/50 backdrop-blur-xl hover:border-cyan-500/40 hover:bg-gray-900/70 transition-all duration-300 ease-in-out shadow-lg shadow-cyan-500/5 hover:shadow-cyan-500/20"
              >
                <button
                  onClick={() =>
                    setOpenIndex(openIndex === index ? null : index)
                  }
                  className={`w-full flex items-center justify-between p-4 md:p-5 transition-colors duration-300 ease-in-out ${
                    dir === "rtl" ? "flex-row-reverse" : ""
                  }`}
                  dir={dir}
                >
                  <span
                    className={`font-semibold text-[var(--text-primary)] text-sm md:text-base lg:text-lg flex-1 ${
                      dir === "rtl" ? "text-right" : "text-left"
                    }`}
                  >
                    {faq.question}
                  </span>
                  <svg
                    className={`w-5 h-5 md:w-6 md:h-6 text-cyan-400 transition-all duration-300 ease-in-out flex-shrink-0 ${
                      dir === "rtl" ? "ml-3 md:ml-4" : "mr-3 md:mr-4"
                    } ${
                      openIndex === index
                        ? "transform rotate-180 scale-110"
                        : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    openIndex === index
                      ? "max-h-96 opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="px-4 md:px-5 pb-4 md:pb-5 border-t border-cyan-500/10">
                    <p
                      className={`text-[var(--text-secondary)] text-sm md:text-base leading-relaxed pt-3 md:pt-4 ${
                        dir === "rtl" ? "text-right" : "text-left"
                      }`}
                      dir={dir}
                    >
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
