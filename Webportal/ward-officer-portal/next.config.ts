import type { NextConfig } from "next";

const hlsProxyTarget = process.env.HLS_PROXY_TARGET || "http://192.168.100.55";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/hls/:path*",
        destination: `${hlsProxyTarget}/hls/:path*`,
      },
    ];
  },
};

export default nextConfig;
