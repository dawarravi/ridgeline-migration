// Server-rendered HTML with string templates: how a lot of older storefronts
// still work. Every page waits on the slow catalog before sending a single
// byte, so the user stares at a blank screen. That is the "pain" we measure.

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export const money = (cents) => `$${(cents / 100).toFixed(2)}`

// Product "photo": a generated SVG so the repo has no image licensing issues.
export const productArt = (p) =>
  `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(p.name)}"><rect width="400" height="400" fill="#f1f5f9"/><path d="M120 110 L170 80 L230 80 L280 110 L320 170 L285 190 L270 165 L270 330 L130 330 L130 165 L115 190 L80 170 Z" fill="${esc(p.color)}"/></svg>`

export function layout(title, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Ridgeline</title>
<style>
body{font-family:Georgia,serif;margin:0;background:#fff;color:#111}
header{background:#111;color:#fff;padding:14px 24px;display:flex;gap:24px;align-items:center}
header a{color:#fff;text-decoration:none}main{max-width:1000px;margin:24px auto;padding:0 16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.card{border:1px solid #ddd;padding:12px}.card a{color:inherit;text-decoration:none}
footer{margin:48px 0 0;padding:12px 24px;background:#fef3c7;font:13px monospace}
button{padding:10px 18px;background:#111;color:#fff;border:0;cursor:pointer}
select{padding:8px}
</style></head><body>
<header><a href="/"><b>RIDGELINE</b></a><a href="/">Shop</a><a href="/cart">Cart</a></header>
<main>${body}</main>
<footer>served by: legacy storefront (Express monolith, off Vercel)</footer>
</body></html>`
}

export function homePage(products) {
  const cards = products
    .map(
      (p) => `<div class="card"><a href="/product/${esc(p.slug)}">${productArt(p)}<h3>${esc(p.name)}</h3><p>${money(p.price)}</p></a></div>`,
    )
    .join('')
  return layout('Shop', `<h1>Gear for the long way up</h1><div class="grid">${cards}</div>`)
}

export function productPage(p, inv) {
  const opts = Object.entries(inv)
    .map(([size, n]) => `<option value="${esc(size)}" ${n === 0 ? 'disabled' : ''}>${esc(size)}${n === 0 ? ' (sold out)' : ''}</option>`)
    .join('')
  return layout(
    p.name,
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
<div>${productArt(p)}</div>
<div><p>${esc(p.category)}</p><h1>${esc(p.name)}</h1><p style="font-size:22px">${money(p.price)}</p><p>${esc(p.description)}</p>
<form method="post" action="/cart/add"><input type="hidden" name="slug" value="${esc(p.slug)}">
<select name="size">${opts}</select> <button>Add to cart</button></form></div></div>`,
  )
}

export function cartPage(lines) {
  if (!lines.length) return layout('Cart', '<h1>Your cart is empty</h1><p><a href="/">Keep shopping</a></p>')
  const rows = lines.map((l) => `<li>${esc(l.name)} (${esc(l.size)}): ${money(l.price)}</li>`).join('')
  const total = lines.reduce((s, l) => s + l.price, 0)
  return layout(
    'Cart',
    `<h1>Cart</h1><ul>${rows}</ul><p><b>Total: ${money(total)}</b></p><form method="post" action="/checkout"><button>Check out</button></form>`,
  )
}

export function notFound() {
  return layout('Not found', '<h1>Not found</h1>')
}
