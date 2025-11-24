'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import en from '../locales/landing/en.json'
import ar from '../locales/landing/ar.json'
import useConfig from '@/hooks/useConfig'
import { ThemeDirection } from '@/config'

type Language = 'en' | 'ar'
type Translations = typeof en

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
  dir: 'ltr' | 'rtl'
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const config = useConfig()
  const i18n = (config?.i18n as Language) || 'ar'
  const [language, setLanguageState] = useState<Language>(i18n === 'ar' || i18n === 'en' ? i18n : 'ar')
  const [translations, setTranslations] = useState<Translations>(language === 'ar' ? ar : en)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Sync with existing config if available
    if (config) {
      const lang = (config.i18n as Language) || 'ar'
      setLanguageState(lang === 'ar' || lang === 'en' ? lang : 'ar')
      setTranslations(lang === 'ar' ? ar : en)
    } else {
      // Fallback to localStorage
      try {
        const savedLang = localStorage.getItem('language') as Language
        if (savedLang && (savedLang === 'en' || savedLang === 'ar')) {
          setLanguageState(savedLang)
          setTranslations(savedLang === 'ar' ? ar : en)
        }
      } catch (e) {
        // ignore
      }
    }
  }, [config])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    setTranslations(lang === 'ar' ? ar : en)
    localStorage.setItem('language', lang)
    
    // Update existing config if available
    if (config?.onChangeLocalization) {
      config.onChangeLocalization(lang)
      config.onChangeDirection(lang === 'ar' ? ThemeDirection.RTL : ThemeDirection.LTR)
    }
    
    // Update document attributes
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lang)
      document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
      document.body.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
    }
  }

  const dir = language === 'ar' ? 'rtl' : 'ltr'

  // Don't render children until mounted to prevent hydration issues
  if (!mounted) {
    return null
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations, dir }} key={language}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

