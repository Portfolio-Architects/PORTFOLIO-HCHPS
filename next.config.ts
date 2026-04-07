import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: isProd ? 'export' : undefined,
  basePath: isProd ? '/PORTFOLIO-HCHPS' : '',
  assetPrefix: isProd ? '/PORTFOLIO-HCHPS/' : '',
  images: {
    unoptimized: true,
  },
  devIndicators: {
    position: 'top-right',
  },
  async rewrites() {
    if (!isProd) {
      return [
        {
          // 브라우저에서 Next.js 서버(3001)로 /api 요청을 보내면, Wrangler(8788)로 프록시
          source: '/api/:path*',
          destination: 'http://127.0.0.1:8788/api/:path*',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
