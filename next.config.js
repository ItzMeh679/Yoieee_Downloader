/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  
  // Enable standalone output for optimized Docker builds
  output: 'standalone',
  
  // Ensure proper transpilation for Safari
  transpilePackages: ['@clerk/nextjs'],
  
  // Add headers for better mobile/Safari support
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
