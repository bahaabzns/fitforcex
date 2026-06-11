import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@heroui/react", "@heroui/styles"],
    // Allow the dev server (HMR, hydration assets) to serve workspace subdomains.
    // Production is unaffected — this only applies to `next dev`.
    allowedDevOrigins: ["lvh.me", "*.lvh.me", "*.localhost"],
};

export default withNextIntl(nextConfig);
