import type { NextConfig } from 'next'

// The strangler-fig front door.
//
// Vercel now receives every request for the storefront domain. Anything the
// Next.js app does not handle itself falls through to the legacy origin.
// "fallback" rewrites run only after Next.js has checked its own pages and
// routes, so migrating a route is just adding a page: no proxy config change,
// and deleting the page sends traffic back to legacy (a code-level rollback).
const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN
if (!LEGACY_ORIGIN) throw new Error('LEGACY_ORIGIN must be set (e.g. https://ridgeline-legacy.up.railway.app)')

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [{ source: '/:path*', destination: `${LEGACY_ORIGIN}/:path*` }],
    }
  },
}

export default nextConfig
