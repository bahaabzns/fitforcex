import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/utils/locales/en.json';
import ar from '@/utils/locales/ar.json';

const resources = {
  en: { translation: en },
  ar: { translation: ar }
};

export function initI18n(defaultLng: 'en' | 'ar' = 'en') {
  if (i18n.isInitialized) return i18n;
  i18n.use(initReactI18next).init({
    resources,
    lng: defaultLng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });
  return i18n;
}

export default i18n;
