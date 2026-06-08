'use client';

import { RouterProvider } from '@heroui/react';
import { ThemeProvider } from 'next-themes';
import { NextIntlClientProvider } from 'next-intl';

export function Providers({ children, defaultTheme = 'system', locale = 'en', messages = {} }) {
    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            <ThemeProvider
                attribute="class"
                defaultTheme={defaultTheme}
                enableSystem
            >
                <RouterProvider>
                    {children}
                </RouterProvider>
            </ThemeProvider>
        </NextIntlClientProvider>
    );
}
