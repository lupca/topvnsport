import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@topvnsport/ui-kit', '@topvnsport/api-client'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'clsx': path.resolve(__dirname, 'node_modules/clsx'),
      'tailwind-merge': path.resolve(__dirname, 'node_modules/tailwind-merge'),
      'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react'),
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/wms-api/:path*',
        destination: 'http://wms-api:8002/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '**',
      },
      {
        protocol: 'https',
        hostname: '**',
      }
    ],
  },
};

export default nextConfig;
