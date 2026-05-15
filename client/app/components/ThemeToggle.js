'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@heroui/react/button';
import { Sun, Moon, Monitor } from 'lucide-react';

const cycles = ['light', 'dark', 'system'];
const icons = { light: Sun, dark: Moon, system: Monitor };
const labels = { light: 'Light', dark: 'Dark', system: 'System' };

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="w-8 h-8 shrink-0" />;

    const current = theme ?? 'system';
    const next = cycles[(cycles.indexOf(current) + 1) % cycles.length];
    const Icon = icons[current] ?? Monitor;

    return (
        <Button
            isIconOnly
            variant="ghost"
            size="sm"
            aria-label={`Theme: ${labels[current]}. Switch to ${labels[next]}`}
            onPress={() => {
                setTheme(next);
                document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
            }}
            className="shrink-0"
        >
            <Icon size={16} />
        </Button>
    );
}
