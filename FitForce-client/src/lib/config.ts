export const APP_CONFIG = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  frontendDomain: process.env.NEXT_PUBLIC_FRONTEND_DOMAIN || 'fitforceapp.com',
  mainDomain: process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'http://localhost:3000',
  defaultTheme: (process.env.NEXT_PUBLIC_DEFAULT_THEME as 'light' | 'dark') || 'light',
  defaultLang: (process.env.NEXT_PUBLIC_DEFAULT_LANG as 'en' | 'ar') || 'en'
} as const;
