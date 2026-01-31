'use client'

import { useLanguage } from '@/lib/landing/LanguageContext'
import TranslateIcon from '@mui/icons-material/Translate'

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage()

  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
      className="flex items-center gap-2 bg-gray-900/50 backdrop-blur-md rounded-lg p-2 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 group"
      title={`Switch to ${language === 'en' ? 'Arabic' : 'English'}`}
    >
      <TranslateIcon className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
      <span className="text-sm font-medium text-gray-300 group-hover:text-cyan-400 transition-colors">
        {language.toUpperCase()}
      </span>
    </button>
  )
}
