'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

const OPTIONS = [
    { value: 'light',  icon: Sun,     label: 'Light'  },
    { value: 'dark',   icon: Moon,    label: 'Dark'   },
    { value: 'system', icon: Monitor, label: 'System' },
];

const BG   = 'lab(15.7305% .613764 -2.16959)';
const HOVER = '#2c2c2c';

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
        <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ backgroundColor: BG }}>
            {OPTIONS.map(({ value, icon: Icon, label }) => {
                const active = current === value;
                return (
                    <button
                        key={value}
                        onClick={() => select(value)}
                        aria-label={label}
                        style={active ? { backgroundColor: HOVER } : undefined}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = HOVER; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = ''; }}
                        className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors shrink-0 cursor-pointer ${
                            active ? 'text-white' : 'text-white/40 hover:text-white'
                        }`}
                    >
                        <Icon size={14} />
                    </button>
                );
            })}
        </div>
    );
}
