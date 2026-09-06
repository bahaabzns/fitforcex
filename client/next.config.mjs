import createNextIntlPlugin from 'next-intl/plugin';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin('./i18n/request.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Lets deploy.sh build into a staging directory and swap it in atomically,
    // instead of overwriting the .next the live `next start` process is reading
    // from mid-build — that race produced ChunkLoadError/MODULE_NOT_FOUND for
    // any request served during a deploy. Defaults to .next everywhere else.
    distDir: process.env.NEXT_DIST_DIR || '.next',
    transpilePackages: ["@heroui/react", "@heroui/styles"],
    // Allow the dev server (HMR, hydration assets) to serve workspace subdomains.
    // Production is unaffected — this only applies to `next dev`.
    allowedDevOrigins: ["lvh.me", "*.lvh.me", "*.localhost"],
    // Root-level package-lock.json in the monorepo confuses Turbopack into treating
    // the repo root as the workspace root instead of this directory. Pin it explicitly.
    turbopack: {
        root: __dirname,
    },
    async redirects() {
        return [
            {
                source: '/client/forms/:id',
                destination: '/portal/forms/:id',
                permanent: true,
            },
            {
                source: '/client-portal',
                destination: '/portal',
                permanent: true,
            },
            {
                source: '/client-portal/:path*',
                destination: '/portal/:path*',
                permanent: true,
            },
            {
                source: '/portal/transformation',
                destination: '/portal/home',
                permanent: true,
            },
        ];
    },
};

export default withNextIntl(nextConfig);
