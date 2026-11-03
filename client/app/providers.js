'use client';

import { useSyncExternalStore } from 'react';
import { RouterProvider } from '@heroui/react';
import { I18nProvider } from 'react-aria-components';
import { ThemeProvider } from 'next-themes';
import { NextIntlClientProvider } from 'next-intl';
import OverlayInertFix from './components/OverlayInertFix';
import MetaPixelTracker from './components/MetaPixelTracker';
import ClarityTracker from './components/ClarityTracker';
import { isDemoFrame } from '@/lib/axios';

const subscribeNoop = () => () => {};

export function Providers({ children, defaultTheme = 'system', locale = 'en', messages = {} }) {
    // Inside the landing page's demo iframe: always dark, and no analytics of any kind.
    const inDemo = useSyncExternalStore(subscribeNoop, isDemoFrame, () => false);
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
                    forcedTheme={inDemo ? 'dark' : undefined}
                >
                    <RouterProvider>
                        <OverlayInertFix />
                        {!inDemo && <MetaPixelTracker />}
                        {!inDemo && <ClarityTracker />}
                        {children}
                    </RouterProvider>
                </ThemeProvider>
            </I18nProvider>
        </NextIntlClientProvider>
    );
}
