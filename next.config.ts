import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/PORTFOLIO-HCHPS',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
