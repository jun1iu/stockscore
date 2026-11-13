import type { NextConfig } from "next";

/** Sent with every response. The site embeds nothing from other origins and needs no device features. */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    // The public API can be called from any site. The refresh route is excluded: it needs the secret.
    const cors = [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
    ];
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      ...['/api/stocks', '/api/stocks/:ticker', '/api/track-record', '/api/status', '/api/health'].map((source) => ({ source, headers: cors })),
    ];
  },
};

export default nextConfig;
