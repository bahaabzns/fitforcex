import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = {
  ar,
  en,
};

export function useTranslation() {
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  
  const t = (key: string): string => {
    return translations[currentLang]?.[key] || translations['en'][key] || key;
  };
  
  return { t };
}

export default useTranslation;

