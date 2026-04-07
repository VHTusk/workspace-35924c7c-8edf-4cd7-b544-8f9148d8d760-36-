import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Allow cross-origin requests from preview panel
  allowedDevOrigins: [
    'localhost',
    '.space.z.ai',
    '.z.ai',
    'preview-chat',
    '.preview-chat',
    'chat',
  ],

  // Disable fast refresh for problematic scenarios
  experimental: {
    // Improve stability
    optimizePackageImports: ['lucide-react', 'recharts'],
  },

  // Redirects for short URLs
  async redirects() {
    return [
      {
        source: '/t/:id',
        destination: '/tournaments/:id',
        permanent: true,
      },
      {
        source: '/p/:id',
        destination: '/players/:id',
        permanent: true,
      },
      {
        source: '/o/:id',
        destination: '/organizations/:id',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
