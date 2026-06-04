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
    const { theme, resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="h-8 w-24 rounded-full shrink-0" />;

    const current  = theme ?? 'system';
    const isDark   = resolvedTheme === 'dark';

    const pillBg     = isDark ? 'lab(15.7305% .613764 -2.16959)' : '#e5e7eb';
    const activeBg   = isDark ? '#2c2c2c' : '#ffffff';
    const hoverBg    = isDark ? '#2c2c2c' : '#d1d5db';
    const activeText  = isDark ? 'text-white'      : 'text-foreground';
    const inactiveText = isDark ? 'text-white/40'  : 'text-gray-500';

    function select(value) {
        setTheme(value);
        document.cookie = `theme=${value}; path=/; max-age=31536000; SameSite=Lax`;
    }

    return (
        <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ backgroundColor: pillBg }}>
            {OPTIONS.map(({ value, icon: Icon, label }) => {
                const active = current === value;
                return (
                    <button
                        key={value}
                        onClick={() => select(value)}
                        aria-label={label}
                        style={{ backgroundColor: active ? activeBg : undefined }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = hoverBg; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = ''; }}
                        className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors shrink-0 cursor-pointer ${
                            active ? activeText : `${inactiveText} hover:${activeText}`
                        }`}
                    >
                        <Icon size={14} />
                    </button>
                );
            })}
        </div>
    );
}
