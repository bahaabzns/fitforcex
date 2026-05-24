'use client';

import NextLink from 'next/link';
import { Button } from '@heroui/react/button';
import { Drawer } from '@heroui/react/drawer';
import { Menu, X } from 'lucide-react';

const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#coaches', label: 'Coaches' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#founder', label: "Founder's Guarantee" },
    { href: '#faq', label: 'FAQ' },
];

export default function LandingNav({ user, dashboardUrl }) {
    return (
        <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/60 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

                {/* Logo */}
                <NextLink href="/" className="flex items-center">
                    <img src="/ff_logo_main.svg" alt="FitForce" className="h-8" />
                </NextLink>

                {/* Desktop nav links */}
                <div className="hidden items-center gap-8 md:flex">
                    {navLinks.map(({ href, label }) => (
                        <a
                            key={href}
                            href={href}
                            className="text-sm font-medium text-white/70 transition-colors hover:text-white"
                        >
                            {label}
                        </a>
                    ))}
                </div>

                {/* Desktop CTA buttons */}
                <div className="hidden items-center gap-2 md:flex">
                    {dashboardUrl ? (
                        <NextLink href={dashboardUrl}>
                            <Button variant="primary" size="md">
                                Go to Dashboard
                            </Button>
                        </NextLink>
                    ) : (
                        <>
                            <NextLink href="/login">
                                <Button variant="ghost" size="md">
                                    Log In
                                </Button>
                            </NextLink>
                            <NextLink href="/register">
                                <Button variant="primary" size="md">
                                    Get Started
                                </Button>
                            </NextLink>
                        </>
                    )}
                </div>

                {/* Mobile hamburger + Drawer */}
                <div className="md:hidden">
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
                                        <img src="/ff_logo_main.svg" alt="FitForce" className="h-7" />
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
                                                    Go to Dashboard
                                                </Button>
                                            </NextLink>
                                        ) : (
                                            <>
                                                <NextLink href="/login" className="w-full">
                                                    <Button variant="outline" size="md" fullWidth>
                                                        Log In
                                                    </Button>
                                                </NextLink>
                                                <NextLink href="/register" className="w-full">
                                                    <Button variant="primary" size="md" fullWidth>
                                                        Get Started
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
