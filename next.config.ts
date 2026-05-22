import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  devIndicators: {
    position: 'top-right',
  },
};

export default nextConfig;
