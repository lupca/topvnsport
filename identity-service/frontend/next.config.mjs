/** @type {import('next').NextConfig} */
const identityApiProxyTarget = process.env.IDENTITY_API_PROXY_TARGET || 'http://identity-api:8000';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/identity-api/:path*',
        destination: `${identityApiProxyTarget}/:path*`,
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
