import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {},
  serverExternalPackages: ['pino', 'pino-pretty'],
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
};

export default nextConfig;
