import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: isProd ? 'export' : undefined,
  basePath: isProd ? '/PORTFOLIO-HCHPS' : '',
  images: {
    unoptimized: true,
  },
  devIndicators: {
    position: 'top-right',
  },
};

export default nextConfig;
