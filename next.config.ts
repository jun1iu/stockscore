import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The public API can be called from any site. The refresh route is excluded: it needs the secret.
  async headers() {
    const cors = [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
    ];
    return ['/api/stocks', '/api/stocks/:ticker', '/api/track-record', '/api/status', '/api/health'].map((source) => ({ source, headers: cors }));
  },
};

export default nextConfig;
