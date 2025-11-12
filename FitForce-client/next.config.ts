/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*'
      }
    ];
  },
  modularizeImports: {
    '@mui/material': {
      transform: '@mui/material/{{member}}'
    },
    '@mui/lab': {
      transform: '@mui/lab/{{member}}'
    }
  },
  experimental: {
    // Optimize package imports for better dev mode performance
    optimizePackageImports: ['@mui/material', '@mui/icons-material', '@mui/lab'],
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        pathname: '**'
      }
    ]
  },
  env: {
    NEXT_APP_VERSION: 'v4.0.0',
    NEXTAUTH_SECRET: 'LlKq6ZtYbr+hTC073mAmAh9/h2HwMfsFo4hrfCx5mLg=',
    NEXTAUTH_URL: 'http://localhost:3000/',
    NEXT_APP_GOOGLE_MAPS_API_KEY: 'AIzaSyAXv4RQK39CskcIB8fvM1Q7XCofZcLxUXw',
    NEXT_APP_MAPBOX_ACCESS_TOKEN: 'pk.eyJ1IjoicmFrZXNoLW5ha3JhbmkiLCJhIjoiY2xsNjNkZm0yMGhvcDNlb3phdjF4dHlzeiJ9.ps6azYbr7M3rGk_QTguMEQ',
    NEXT_APP_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.nano.com',
    NEXT_APP_JWT_SECRET: 'ikRgjkhi15HJiU78-OLKfjngiu',
    NEXT_APP_JWT_TIMEOUT: '86400',
    NEXTAUTH_SECRET_KEY: 'LlKq6ZtYbr+hTC073mAmAh9/h2HwMfsFo4hrfCx5mLg='
  },
  outputFileTracingRoot: path.join(__dirname, './'),
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Fix react-joyride compatibility with React 19
      // Only replace react-dom imports within react-joyride package
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^react-dom$/,
          (resource) => {
            // Only apply to react-joyride
            if (resource.context && resource.context.includes('react-joyride')) {
              resource.request = path.resolve(__dirname, './src/lib/react-dom-compat-wrapper.ts');
            }
          }
        )
      );
    }
    return config;
  }
};

module.exports = nextConfig;
