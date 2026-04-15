import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Disable HMR cache in dev to always serve fresh assets
    serverComponentsHmrCache: false,
  },
  async headers() {
    const headers = [
      {
        source: '/t/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtube.com https://youtu.be;",
          },
        ],
      },
    ]
    // In dev, prevent browser caching of all routes
    if (process.env.NODE_ENV === 'development') {
      headers.push({
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      })
    }
    return headers
  },
};

export default nextConfig;
