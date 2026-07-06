/** @type {import('next').NextConfig} */
const pmiApiProxyTarget = process.env.PMI_API_PROXY_TARGET || 'http://api:8000';
const wmsApiProxyTarget = process.env.WMS_API_PROXY_TARGET || 'http://wms-api:8002';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/pmi-api/:path*',
        destination: `${pmiApiProxyTarget}/:path*`,
      },
      {
        source: '/wms-api/:path*',
        destination: `${wmsApiProxyTarget}/:path*`,
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
