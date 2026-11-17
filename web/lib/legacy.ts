// The boundary. Every call from the new storefront into the customer's
// existing systems goes through this file, so there is exactly one place
// that knows the origin URL and the credential.
//
// Production note: here we authenticate with a static bearer token over the
// public internet. For a real customer the legacy API would sit in a private
// VPC, reached through Vercel Secure Compute (VPC peering, static egress IPs)
// or a short-lived token, and the token would be rotated, not long-lived.

export type Product = {
  slug: string
  name: string
  category: string
  price: number // cents
  color: string
  description: string
}

export type Inventory = { slug: string; sizes: Record<string, number> }

function config() {
  const origin = process.env.LEGACY_ORIGIN
  const token = process.env.LEGACY_API_TOKEN
  if (!origin || !token) throw new Error('LEGACY_ORIGIN and LEGACY_API_TOKEN must be set')
  return { origin, token }
}

async function legacyGet<T>(path: string): Promise<T | null> {
  const { origin, token } = config()
  const res = await fetch(new URL(path, origin), {
    headers: { authorization: `Bearer ${token}` },
    // Fail fast instead of holding a function open if legacy is down.
    signal: AbortSignal.timeout(5000),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`legacy ${path} -> ${res.status}`)
  return (await res.json()) as T
}

const SLUG = /^[a-z0-9-]{1,64}$/

export const listProducts = () => legacyGet<Product[]>('/api/products').then((p) => p ?? [])

export const getProduct = (slug: string) =>
  SLUG.test(slug) ? legacyGet<Product>(`/api/products/${slug}`) : Promise.resolve(null)

export const getInventory = (slug: string) =>
  SLUG.test(slug) ? legacyGet<Inventory>(`/api/inventory/${slug}`) : Promise.resolve(null)

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
