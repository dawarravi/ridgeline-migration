import { type NextRequest, NextResponse } from 'next/server'
import { newProductPage, VISITOR_COOKIE } from './flags'

// Runs before routing and before Vercel's CDN cache, so it can choose a
// version per shopper even though the new product page is cached.
// Scoped to product pages only: every request it matches costs one
// invocation, so it never runs for home, cart or assets.
export const config = { matcher: '/product/:slug' }

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export async function proxy(request: NextRequest) {
  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value
  const isNew = !visitorId || !UUID.test(visitorId)
  if (isNew) visitorId = crypto.randomUUID()

  // A first-time shopper has no cookie yet, so hand the flag a copy of the
  // request that includes the ID we are about to set.
  const headers = new Headers(request.headers)
  if (isNew) {
    const others = request.cookies.getAll().filter((c) => c.name !== VISITOR_COOKIE)
    headers.set('cookie', [...others.map((c) => `${c.name}=${c.value}`), `${VISITOR_COOKIE}=${visitorId}`].join('; '))
  }
  const useNew = await newProductPage(new Request(request.url, { headers }))

  const res =
    useNew || !LEGACY_ORIGIN
      ? NextResponse.next()
      : // Same path on the fixed legacy origin (never a user-supplied host).
        NextResponse.rewrite(new URL(request.nextUrl.pathname + request.nextUrl.search, LEGACY_ORIGIN))

  if (isNew) {
    res.cookies.set(VISITOR_COOKIE, visitorId!, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  }
  // Lets us (and Web Analytics later) see which version a shopper got.
  res.headers.set('x-ridgeline-variant', useNew ? 'new' : 'legacy')
  return res
}
