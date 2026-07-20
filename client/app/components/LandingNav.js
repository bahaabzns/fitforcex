'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@heroui/react/button';
import { Drawer } from '@heroui/react/drawer';
import { Menu, X } from 'lucide-react';
import LanguageSwitcher from '@/app/components/LanguageSwitcher';

export default function LandingNav({ user, dashboardUrl }) {
    const t = useTranslations('landing.nav');
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        function onScroll() {
            setScrolled(window.scrollY > 10);
        }
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const navLinks = [
        { href: '#features', label: t('features') },
        { href: '#coaches', label: t('coaches') },
        { href: '#pricing', label: t('pricing') },
        { href: '#founder', label: t('founder') },
        { href: '#faq', label: t('faq') },
    ];

    return (
        <nav
            className={`sticky top-0 z-50 w-full backdrop-blur-md transition-colors duration-300 ${
                scrolled
                    ? 'border-b border-primary/20 bg-black/80 shadow-lg shadow-primary/5'
                    : 'border-b border-white/10 bg-black/40'
            }`}
        >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">

                {/* Logo */}
                <NextLink href="/" className="flex shrink-0 items-center">
                    {/* Landing is forced dark mode → white-wordmark lockup */}
                    <img src="/blue_white.png" alt="FitForce" className="h-8 w-auto" />
                </NextLink>

                {/* Desktop nav links */}
                <div className="hidden items-center gap-8 md:flex">
                    {navLinks.map(({ href, label }) => (
                        <a
                            key={href}
                            href={href}
                            className="group relative text-sm font-medium text-white/70 transition-colors hover:text-white"
                        >
                            {label}
                            <span className="absolute -bottom-1 inset-s-0 h-0.5 w-0 bg-primary transition-all duration-300 group-hover:w-full" />
                        </a>
                    ))}
                </div>

                {/* Desktop CTA buttons */}
                <div className="hidden items-center gap-3 md:flex">
                    <LanguageSwitcher />
                    {dashboardUrl ? (
                        <NextLink href={dashboardUrl}>
                            <Button variant="primary" size="md">
                                {t('goToDashboard')}
                            </Button>
                        </NextLink>
                    ) : (
                        <>
                            <NextLink href="/login">
                                <Button variant="ghost" size="md">
                                    {t('login')}
                                </Button>
                            </NextLink>
                            <NextLink href="/register">
                                <Button variant="primary" size="md">
                                    {t('getStarted')}
                                </Button>
                            </NextLink>
                        </>
                    )}
                </div>

                {/* Mobile hamburger + Drawer */}
                <div className="flex items-center gap-2 md:hidden">
                    <LanguageSwitcher />
                    <Drawer>
                        <Drawer.Trigger
                            className="inline-flex items-center justify-center rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label="Open menu"
                        >
                            <Menu className="h-5 w-5" />
                        </Drawer.Trigger>

                        <Drawer.Backdrop isDismissable>
                            <Drawer.Content placement="right" className="w-72">
                                <Drawer.Dialog className="flex h-full flex-col bg-background">

                                    <Drawer.Header className="flex items-center justify-between border-b border-border px-6 py-4">
                                        <img src="/blue_white.png" alt="FitForce" className="h-7 w-auto" />
                                        <Drawer.CloseTrigger className="inline-flex items-center justify-center rounded-lg p-1.5 text-foreground/60 transition-colors hover:bg-surface hover:text-foreground">
                                            <X className="h-5 w-5" />
                                        </Drawer.CloseTrigger>
                                    </Drawer.Header>

                                    <Drawer.Body className="flex flex-col gap-1 px-4 py-6">
                                        {navLinks.map(({ href, label }) => (
                                            <a
                                                key={href}
                                                href={href}
                                                className="rounded-lg px-3 py-2.5 text-base font-medium text-foreground/70 transition-colors hover:bg-surface hover:text-foreground"
                                            >
                                                {label}
                                            </a>
                                        ))}
                                    </Drawer.Body>

                                    <Drawer.Footer className="flex flex-col gap-3 border-t border-border px-6 py-6">
                                        {dashboardUrl ? (
                                            <NextLink href={dashboardUrl} className="w-full">
                                                <Button variant="primary" size="md" fullWidth>
                                                    {t('goToDashboard')}
                                                </Button>
                                            </NextLink>
                                        ) : (
                                            <>
                                                <NextLink href="/login" className="w-full">
                                                    <Button variant="outline" size="md" fullWidth>
                                                        {t('login')}
                                                    </Button>
                                                </NextLink>
                                                <NextLink href="/register" className="w-full">
                                                    <Button variant="primary" size="md" fullWidth>
                                                        {t('getStarted')}
                                                    </Button>
                                                </NextLink>
                                            </>
                                        )}
                                    </Drawer.Footer>

                                </Drawer.Dialog>
                            </Drawer.Content>
                        </Drawer.Backdrop>
                    </Drawer>
                </div>

            </div>
        </nav>
    );
}
