import { useEffect, ReactNode } from 'react';

// material-ui
import { CacheProvider } from '@emotion/react';
import createCache, { StylisPlugin } from '@emotion/cache';

// third-party
import rtlPlugin from 'stylis-plugin-rtl';

// project-imports
import useConfig from 'hooks/useConfig';
import { ThemeDirection } from 'config';

// ==============================|| RTL LAYOUT ||============================== //

interface Props {
  children: ReactNode;
}

export default function RTLLayout({ children }: Props) {
  const { themeDirection, i18n } = useConfig();

  useEffect(() => {
    document.dir = themeDirection;
    // Set lang attribute for Arabic
    if (i18n === 'ar') {
      document.documentElement.lang = 'ar';
    } else {
      document.documentElement.lang = 'en';
    }
  }, [themeDirection, i18n]);

  const cacheRtl = createCache({
    key: themeDirection === ThemeDirection.RTL ? 'rtl' : 'css',
    prepend: true,
    stylisPlugins: themeDirection === ThemeDirection.RTL ? [rtlPlugin as StylisPlugin] : []
  });

  return <CacheProvider value={cacheRtl}>{children}</CacheProvider>;
}
