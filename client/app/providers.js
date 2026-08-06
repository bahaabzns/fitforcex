'use client';

import { RouterProvider } from '@heroui/react';
import { I18nProvider } from 'react-aria-components';
import { ThemeProvider } from 'next-themes';
import { NextIntlClientProvider } from 'next-intl';
import OverlayInertFix from './components/OverlayInertFix';

export function Providers({ children, defaultTheme = 'system', locale = 'en', messages = {} }) {
    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            {/* React Aria manages its own locale/direction context, defaulting to
                the browser's navigator.language — independent of this app's own
                dir attribute. Without this, RTL-only components (Popover, etc.)
                render LTR whenever the visitor's browser language isn't Arabic,
                even though the app itself is displaying Arabic content. */}
            <I18nProvider locale={locale}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme={defaultTheme}
                    enableSystem
                >
                    <RouterProvider>
                        <OverlayInertFix />
                        {children}
                    </RouterProvider>
                </ThemeProvider>
            </I18nProvider>
        </NextIntlClientProvider>
    );
}
