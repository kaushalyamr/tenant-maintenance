// In production the browser calls this app's own /api paths and Next.js proxies
// them to the Express deployment. Keeping the API same-origin means the session
// cookie is not a cross-site cookie, so Safari and Chrome send it normally.
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: '/api/:path*', destination: `${apiProxyTarget}/api/:path*` }];
  },
};

export default nextConfig;
