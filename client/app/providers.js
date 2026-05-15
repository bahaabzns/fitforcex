'use client';

import { RouterProvider } from '@heroui/react';
import { ThemeProvider } from 'next-themes';

export function Providers({ children, defaultTheme = 'system' }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme={defaultTheme}
            enableSystem
        >
            <RouterProvider>
                {children}
            </RouterProvider>
        </ThemeProvider>
    );
}
