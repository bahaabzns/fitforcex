import createNextIntlPlugin from 'next-intl/plugin';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin('./i18n/request.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@heroui/react", "@heroui/styles"],
    // Allow the dev server (HMR, hydration assets) to serve workspace subdomains.
    // Production is unaffected — this only applies to `next dev`.
    allowedDevOrigins: ["lvh.me", "*.lvh.me", "*.localhost"],
    // Root-level package-lock.json in the monorepo confuses Turbopack into treating
    // the repo root as the workspace root instead of this directory. Pin it explicitly.
    turbopack: {
        root: __dirname,
    },
};

export default withNextIntl(nextConfig);
