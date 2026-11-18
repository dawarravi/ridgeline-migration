import { createHmac, timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'

// Called by the legacy admin when a merchandiser changes a price.
// The body is signed with a shared secret (HMAC-SHA256), so nobody else can
// force cache purges, which would otherwise be a cheap way to hammer the
// slow legacy catalog.

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) return Response.json({ error: 'not configured' }, { status: 500 })

  const body = await req.text()
  if (body.length > 1024) return Response.json({ error: 'too large' }, { status: 413 })

  // Replay protection: the signature covers the timestamp, and we only
  // accept requests signed in the last 5 minutes. (A replay inside that
  // window only re-purges the same product, which is harmless.)
  const timestamp = req.headers.get('x-ridgeline-timestamp') ?? ''
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!/^\d{10}$/.test(timestamp) || !(age <= 300)) {
    return Response.json({ error: 'stale or missing timestamp' }, { status: 401 })
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest()
  const given = Buffer.from(req.headers.get('x-ridgeline-signature') ?? '', 'hex')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: 'bad signature' }, { status: 401 })
  }

  let slug: unknown
  try {
    slug = (JSON.parse(body) as { slug?: unknown }).slug
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 })
  }
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,64}$/.test(slug)) {
    return Response.json({ error: 'bad slug' }, { status: 400 })
  }

  // { expire: 0 } = purge now; the next shopper gets the new price.
  // The alternative, 'max', serves the old price once more while refreshing
  // in the background (faster, but wrong for prices).
  revalidateTag(`product:${slug}`, { expire: 0 })
  return Response.json({ revalidated: `product:${slug}` })
}
