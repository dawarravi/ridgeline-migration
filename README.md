# Ridgeline: strangler-fig migration to Vercel (POC)

A proof of concept for moving a legacy commerce storefront to Next.js on Vercel **one route at a time**, while the systems that matter (catalog, inventory, cart, checkout) stay where they are.

- Live demo: https://ridgeline-migration.vercel.app/product/summit-shell-jacket
- Legacy store: https://ridgeline-migration.onrender.com

> Ridgeline is a fictional outdoor-apparel retailer.

| Folder | What it is | Runs on |
|---|---|---|
| `legacy/` | The customer's existing Express storefront + internal catalog/inventory API | Render, Virginia (stands in for the customer's cloud) |
| `web/` | The new Next.js 16 storefront, the front door for all traffic | Vercel |
| `evals/` | Regression test set for the shopping assistant | Runs against any deployment |
| `loadtest/` | k6 load test of the legacy product page (legacy only) | Your machine |
| `measure/` | Lab LCP measurement in headless Chrome | Your machine |
