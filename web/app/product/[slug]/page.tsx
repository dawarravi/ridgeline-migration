import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { cacheLife, cacheTag } from 'next/cache'
import { getProduct, getInventory, listProducts, money } from '@/lib/legacy'
import { ProductArt } from '@/components/ProductArt'
import { Assistant } from '@/components/Assistant'

// The first migrated route: the product detail page (PDP).
//
// The page is split by how fresh each piece of data must be:
//   - Product info (name, price, description) changes rarely. It is cached
//     and prerendered into a static shell served from Vercel's CDN, so
//     shoppers never wait on the slow legacy catalog.
//   - Stock per size changes constantly and must never be stale. It is a
//     dynamic "hole" that streams in after the shell is already on screen.

// Prerender every product at build time. New products added later still
// work: they render on first request and are cached after that.
export async function generateStaticParams() {
  const products = await listProducts()
  return products.map((p) => ({ slug: p.slug }))
}

async function getCachedProduct(slug: string) {
  'use cache'
  // One tag per product, so a price change invalidates exactly one page,
  // not the whole catalog (see app/api/revalidate/route.ts).
  cacheTag(`product:${slug}`)
  // Safety net: even without a webhook, refresh at most daily.
  cacheLife('days')
  const product = await getProduct(slug)
  return product ? { product, cachedAt: new Date().toISOString() } : null
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getCachedProduct(slug)
  // Trade-off: the shell has already streamed with a 200 by the time we know
  // the slug is unknown, so this renders the not-found page with a noindex
  // tag but keeps status 200. dynamicParams=false would give a real 404 but
  // is not allowed with Cache Components.
  if (!result) notFound()
  const { product, cachedAt } = result

  return (
    <div className="pdp">
      <ProductArt name={product.name} color={product.color} />
      <div>
        <p className="muted">{product.category}</p>
        <h1>{product.name}</h1>
        <p className="price">{money(product.price)}</p>
        <p>{product.description}</p>
        <Suspense fallback={<p className="muted">Checking stock…</p>}>
          <AddToCart slug={slug} />
        </Suspense>
        <p className="debug">product data cached at {cachedAt}</p>
      </div>
      <Assistant slug={slug} name={product.name} />
    </div>
  )
}

// Not cached: runs on every request and streams in after the shell.
async function AddToCart({ slug }: { slug: string }) {
  const inv = await getInventory(slug)
  if (!inv) return <p>Stock unavailable right now.</p>
  return (
    // Posts straight to the legacy cart: Next.js has no /cart/add route, so
    // the fallback rewrite forwards it. Cart and checkout stay on legacy.
    <form method="post" action="/cart/add">
      <input type="hidden" name="slug" value={slug} />
      <select name="size" defaultValue="">
        <option value="" disabled>
          Select size
        </option>
        {Object.entries(inv.sizes).map(([size, n]) => (
          <option key={size} value={size} disabled={n === 0}>
            {size} {n === 0 ? '(sold out)' : n < 3 ? `(only ${n} left)` : ''}
          </option>
        ))}
      </select>{' '}
      <button>Add to cart</button>
    </form>
  )
}
