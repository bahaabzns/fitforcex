'use client';

import { useEffect } from 'react';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost';

// The `my.` subdomain hosts the logged-in coach app. Auth pages (login, register,
// password reset…) belong on the bare root domain, so if we land here under `my.`
// strip it — the subdomain should only ever appear once a coach is inside a workspace.
export default function AuthLayout({ children }) {
    useEffect(() => {
        const { hostname, protocol, port, pathname, search, hash } = window.location;
        const root = ROOT_DOMAIN.split(':')[0].toLowerCase();
        if (hostname.toLowerCase() === `my.${root}`) {
            const host = port ? `${root}:${port}` : root;
            window.location.replace(`${protocol}//${host}${pathname}${search}${hash}`);
        }
    }, []);

    return children;
}
