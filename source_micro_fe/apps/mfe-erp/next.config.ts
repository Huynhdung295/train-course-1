import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nexus/ui', '@nexus/auth', '@nexus/api-client', '@nexus/types', '@nexus/utils'],
};

export default nextConfig;
