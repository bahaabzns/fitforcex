'use client';

import Link from 'next/link';
import LanguageSwitcher from './LanguageSwitcher';

export default function LegalPageLayout({ backToHomeLabel, children }) {
    return (
        <main className="dark min-h-screen bg-[#080d1a] text-white flex flex-col">
            <header className="border-b border-white/10">
                <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
                    <Link href="/" className="flex items-center gap-2">
                        <img src="/blue_white.png" alt="FitForce" className="h-7 w-auto" />
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-sm text-white/45 hover:text-white transition-colors">
                            {backToHomeLabel}
                        </Link>
                        <LanguageSwitcher />
                    </div>
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-6 py-16 flex-1 w-full">
                {children}
            </div>

            <footer className="border-t border-white/10">
                <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between gap-4">
                    <p className="text-xs text-white/25">
                        © {new Date().getFullYear()} FitForce. All rights reserved.
                    </p>
                    <Link href="/" className="text-sm text-white/45 hover:text-white transition-colors">
                        {backToHomeLabel}
                    </Link>
                </div>
            </footer>
        </main>
    );
}
