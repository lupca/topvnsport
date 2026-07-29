/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@topvnsport/ui-kit', '@topvnsport/api-client'],
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
