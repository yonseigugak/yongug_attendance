import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https:;
              style-src 'self' 'unsafe-inline' https:;
              img-src 'self' data: blob: https:;
              font-src 'self' data: https:;
              connect-src 'self' https: http:;
              frame-src 'self' https:;
              object-src 'none';
              base-uri 'self';
              form-action 'self';
            `.replace(/\n/g, ""),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
