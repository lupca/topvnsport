/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@voma/ui-kit', '@voma/api-client'],
  async rewrites() {
    return [
      {
        source: '/oms-api/:path*',
        destination: 'http://oms_backend:8001/:path*',
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
