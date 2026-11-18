import express from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { listProducts, getProduct, getInventory, setPrice, decrementStock } from './catalog.js'
import { homePage, productPage, cartPage, notFound, layout, money } from './views.js'

const app = express()
app.disable('x-powered-by')
app.use(express.urlencoded({ extended: false, limit: '10kb' }))
app.use(express.json({ limit: '10kb' }))

const API_TOKEN = process.env.LEGACY_API_TOKEN ?? ''
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''
const WEBHOOK_URL = process.env.REVALIDATE_WEBHOOK_URL ?? ''
const WEBHOOK_SECRET = process.env.REVALIDATE_SECRET ?? ''

const safeEqual = (a, b) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

// ---------------------------------------------------------------------------
// Storefront pages (the part we migrate to Vercel, one route at a time)
// ---------------------------------------------------------------------------

app.get('/', async (_req, res) => {
  res.send(homePage(await listProducts()))
})

app.get('/product/:slug', async (req, res) => {
  const p = await getProduct(req.params.slug)
  if (!p) return res.status(404).send(notFound())
  res.send(productPage(p, getInventory(p.slug)))
})

// Cart and checkout stay on legacy in this POC: they touch payments and
// sessions, which is exactly what a customer moves last (or never).
const readCart = (req) => {
  const raw = /(?:^|;\s*)cart=([^;]+)/.exec(req.headers.cookie ?? '')?.[1]
  try {
    const items = JSON.parse(Buffer.from(decodeURIComponent(raw ?? ''), 'base64url').toString())
    return Array.isArray(items) ? items.slice(0, 20) : []
  } catch {
    return []
  }
}
const writeCart = (res, items) =>
  res.setHeader('Set-Cookie', `cart=${Buffer.from(JSON.stringify(items)).toString('base64url')}; Path=/; HttpOnly; SameSite=Lax`)

app.post('/cart/add', async (req, res) => {
  const { slug, size } = req.body ?? {}
  const inv = getInventory(String(slug))
  if (!inv || !(String(size) in inv)) return res.status(400).send(layout('Error', '<h1>Pick a size</h1>'))
  writeCart(res, [...readCart(req), { slug: String(slug), size: String(size) }])
  res.redirect(303, '/cart')
})

app.get('/cart', async (req, res) => {
  // Prices come from the catalog, never from the cookie.
  const lines = []
  for (const item of readCart(req)) {
    const p = await getProduct(item.slug)
    if (p) lines.push({ name: p.name, size: item.size, price: p.price })
  }
  res.send(cartPage(lines))
})

app.post('/checkout', (req, res) => {
  const items = readCart(req)
  const ok = items.filter((i) => decrementStock(i.slug, i.size)).length
  writeCart(res, [])
  res.send(layout('Thanks', `<h1>Order placed</h1><p>${ok} item(s) reserved. (Demo store: nothing is charged.)</p><p><a href="/">Back to shop</a></p>`))
})

// ---------------------------------------------------------------------------
// Internal API: what the new Vercel storefront calls across the boundary.
// Bearer token here; in production this sits in a private VPC reached via
// Vercel Secure Compute (VPC peering + static egress IPs).
// ---------------------------------------------------------------------------

const requireToken = (req, res, next) => {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1] ?? ''
  if (!safeEqual(token, API_TOKEN)) return res.status(401).json({ error: 'unauthorized' })
  next()
}

app.get('/api/products', requireToken, async (_req, res) => res.json(await listProducts()))

app.get('/api/products/:slug', requireToken, async (req, res) => {
  const p = await getProduct(req.params.slug)
  p ? res.json(p) : res.status(404).json({ error: 'not_found' })
})

app.get('/api/inventory/:slug', requireToken, (req, res) => {
  const inv = getInventory(req.params.slug)
  inv ? res.json({ slug: req.params.slug, sizes: inv }) : res.status(404).json({ error: 'not_found' })
})

// ---------------------------------------------------------------------------
// Merchandiser admin: change a price, then tell Vercel which cache tag is
// stale (signed webhook). This is the "targeted invalidation" story.
// ---------------------------------------------------------------------------

const requireAdmin = (req, res, next) => {
  const [user, pass] = Buffer.from((req.headers.authorization ?? '').replace(/^Basic /, ''), 'base64').toString().split(':')
  if (user === 'admin' && safeEqual(pass ?? '', ADMIN_PASSWORD)) return next()
  res.setHeader('WWW-Authenticate', 'Basic realm="ridgeline-admin"').status(401).send('auth required')
}

async function notifyVercel(slug) {
  if (!WEBHOOK_URL || !WEBHOOK_SECRET) return 'webhook not configured'
  const body = JSON.stringify({ type: 'product.updated', slug })
  // Sign the timestamp together with the body, so a captured request can't
  // be replayed later: the receiver rejects anything older than 5 minutes.
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createHmac('sha256', WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex')
  try {
    const r = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ridgeline-timestamp': timestamp,
        'x-ridgeline-signature': signature,
      },
      body,
      signal: AbortSignal.timeout(5000),
    })
    return `webhook ${r.status}`
  } catch {
    return 'webhook failed'
  }
}

app.get('/admin', requireAdmin, async (_req, res) => {
  const rows = (await listProducts())
    .map((p) => `<tr><td>${p.name}</td><td>${money(p.price)}</td><td><form method="post" action="/admin/price"><input type="hidden" name="slug" value="${p.slug}"><input name="price" size="8" placeholder="e.g. 299.00"> <button>Update</button></form></td></tr>`)
    .join('')
  res.send(layout('Admin', `<h1>Merchandising admin</h1><table>${rows}</table>`))
})

app.post('/admin/price', requireAdmin, async (req, res) => {
  const cents = Math.round(Number(req.body?.price) * 100)
  if (!Number.isFinite(cents) || cents <= 0 || cents > 10_000_00) return res.status(400).send('bad price')
  const p = setPrice(String(req.body?.slug), cents)
  if (!p) return res.status(404).send('not found')
  const status = await notifyVercel(p.slug)
  res.send(layout('Saved', `<h1>${p.name} is now ${money(p.price)}</h1><p>${status}</p><p><a href="/admin">Back</a></p>`))
})

app.get('/healthz', (_req, res) => res.json({ ok: true }))
app.use((_req, res) => res.status(404).send(notFound()))

const port = Number(process.env.PORT ?? 4000)
app.listen(port, () => console.log(`legacy storefront on :${port}`))
