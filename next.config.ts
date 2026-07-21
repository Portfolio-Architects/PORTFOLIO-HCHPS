import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  devIndicators: {
    position: 'top-right',
  },
  turbopack: {},
  webpack: (config) => {
    if (config.watchOptions) {
      const existingIgnored = Array.isArray(config.watchOptions.ignored)
        ? config.watchOptions.ignored
        : config.watchOptions.ignored
        ? [config.watchOptions.ignored]
        : [];
      config.watchOptions.ignored = [
        ...existingIgnored,
        '**/data/**',
        '**/scratch/**',
        '**/*.json',
      ];
    } else {
      config.watchOptions = {
        ignored: ['**/data/**', '**/scratch/**', '**/*.json']
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'unload=*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
