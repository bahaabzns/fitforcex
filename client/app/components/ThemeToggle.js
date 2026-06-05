'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

const OPTIONS = [
    { value: 'light',  icon: Sun,     label: 'Light'  },
    { value: 'dark',   icon: Moon,    label: 'Dark'   },
    { value: 'system', icon: Monitor, label: 'System' },
];

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="h-8 w-24 rounded-full shrink-0" />;

    const current = theme ?? 'system';

    function select(value) {
        setTheme(value);
        document.cookie = `theme=${value}; path=/; max-age=31536000; SameSite=Lax`;
    }

    return (
        <div
            className="flex items-center gap-0.5 rounded-full p-0.5"
            style={{ backgroundColor: 'var(--color-default)' }}
        >
            {OPTIONS.map(({ value, icon: Icon, label }) => {
                const active = current === value;
                return (
                    <button
                        key={value}
                        onClick={() => select(value)}
                        aria-label={label}
                        style={{ backgroundColor: active ? 'var(--color-background)' : undefined }}
                        className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors shrink-0 cursor-pointer ${
                            active ? 'text-foreground' : 'text-muted hover:opacity-70'
                        }`}
                    >
                        <Icon size={14} />
                    </button>
                );
            })}
        </div>
    );
}
