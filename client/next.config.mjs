import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@heroui/react", "@heroui/styles"],
};

export default withNextIntl(nextConfig);
