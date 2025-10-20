
export const APP_CONFIG = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.fitforce.io',
  // apiUrl:'https://api.fitforce.io',
  frontendDomain: process.env.NEXT_PUBLIC_FRONTEND_DOMAIN || 'fitforce.io',
  // frontendDomain: 'fitforce.io',
  mainDomain: process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'https://fitforce.io',
  // mainDomain: 'https://fitforce.io',
  managementSubdomain: process.env.NEXT_PUBLIC_MANAGEMENT_SUBDOMAIN || 'admin',
  // Optional: workspace whose public packages should be showcased on main landing
  featuredWorkspaceId: process.env.NEXT_PUBLIC_FEATURED_WORKSPACE_ID || '',
  defaultTheme: (process.env.NEXT_PUBLIC_DEFAULT_THEME as 'light' | 'dark') || 'light',
  defaultLang: (process.env.NEXT_PUBLIC_DEFAULT_LANG as 'en' | 'ar') || 'en'
} as const;


 