// The "legacy" catalog. In the real customer this is a monolith database
// (think RDS behind an EKS service). Here it's an in-memory store, reset on
// restart, which is enough to play the role of "the system that stays".

export const SIZES = ['XS', 'S', 'M', 'L', 'XL']

const seed = [
  { slug: 'summit-shell-jacket', name: 'Summit Shell Jacket', category: 'Jackets', price: 34900, color: '#c2410c', description: 'Three-layer waterproof shell for alpine days. Fully taped seams, helmet-compatible hood, pit zips.' },
  { slug: 'fjord-insulated-parka', name: 'Fjord Insulated Parka', category: 'Jackets', price: 42900, color: '#1e3a8a', description: 'Synthetic-insulated parka that keeps its warmth when wet. Built for coastal winters.' },
  { slug: 'ridge-fleece-midlayer', name: 'Ridge Fleece Midlayer', category: 'Midlayers', price: 11900, color: '#15803d', description: 'Grid fleece that breathes on the climb and traps heat at the summit.' },
  { slug: 'tundra-merino-base', name: 'Tundra Merino Base Layer', category: 'Base layers', price: 8900, color: '#7c2d12', description: '200gsm merino crew. Odor-resistant for multi-day trips.' },
  { slug: 'glacier-softshell-pant', name: 'Glacier Softshell Pant', category: 'Pants', price: 15900, color: '#334155', description: 'Stretch softshell with reinforced cuffs and a harness-friendly waist.' },
  { slug: 'harbor-rain-jacket', name: 'Harbor Rain Jacket', category: 'Jackets', price: 18900, color: '#ca8a04', description: 'Everyday 2.5-layer rain jacket that packs into its own pocket.' },
  { slug: 'aurora-down-vest', name: 'Aurora Down Vest', category: 'Midlayers', price: 16900, color: '#7e22ce', description: '800-fill responsibly sourced down vest for cold mornings.' },
  { slug: 'trail-wool-beanie', name: 'Trail Wool Beanie', category: 'Accessories', price: 3900, color: '#be123c', description: 'Rib-knit merino beanie. One size.' },
]

const products = new Map(seed.map((p) => [p.slug, { ...p }]))

// Inventory per size. Deterministic start so demos are repeatable.
const inventory = new Map(
  seed.map((p, i) => [p.slug, Object.fromEntries(SIZES.map((s, j) => [s, (i * 7 + j * 3) % 9]))]),
)

// Simulates the slow monolith query that is the customer's core pain.
// Configurable so the load test and the demo can turn it up or down.
const LATENCY_MS = Number(process.env.CATALOG_LATENCY_MS ?? 700)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function listProducts() {
  await sleep(LATENCY_MS)
  return [...products.values()]
}

export async function getProduct(slug) {
  await sleep(LATENCY_MS)
  return products.get(slug) ?? null
}

// Inventory is deliberately fast: it's the "real-time" service that the new
// storefront must never cache.
export function getInventory(slug) {
  return inventory.get(slug) ?? null
}

export function setPrice(slug, priceCents) {
  const p = products.get(slug)
  if (!p) return null
  p.price = priceCents
  return p
}

export function decrementStock(slug, size) {
  const inv = inventory.get(slug)
  if (!inv || !(size in inv) || inv[size] <= 0) return false
  inv[size] -= 1
  return true
}
