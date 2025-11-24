'use client';

import { useLanguage } from '@/lib/landing/LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2 bg-gray-900/50 backdrop-blur-md rounded-lg p-1 border border-cyan-500/20">
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all duration-300 ${
          language === 'en'
            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
            : 'text-gray-400 hover:text-cyan-400'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('ar')}
        className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all duration-300 ${
          language === 'ar'
            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
            : 'text-gray-400 hover:text-cyan-400'
        }`}
      >
        AR
      </button>
    </div>
  );
}
