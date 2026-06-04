'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@heroui/react/button';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="w-16 h-8 shrink-0" />;

    function select(t) {
        setTheme(t);
        document.cookie = `theme=${t}; path=/; max-age=31536000; SameSite=Lax`;
    }

    const isDark = resolvedTheme === 'dark';

    return (
        <div className="flex items-center">
            <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label="Light mode"
                onPress={() => select('light')}
                className={`shrink-0 ${!isDark ? 'text-foreground' : 'text-muted-foreground'}`}
            >
                <Sun size={16} />
            </Button>
            <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label="Dark mode"
                onPress={() => select('dark')}
                className={`shrink-0 ${isDark ? 'text-foreground' : 'text-muted-foreground'}`}
            >
                <Moon size={16} />
            </Button>
        </div>
    );
}
