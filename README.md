# Ridgeline: strangler-fig migration to Vercel (POC)

A proof of concept for moving a legacy commerce storefront to Next.js on Vercel **one route at a time**, while the systems that matter (catalog, inventory, cart, checkout) stay where they are.

> Ridgeline is a fictional outdoor-apparel retailer. Work in progress: see commit history.

| Folder | What it is | Runs on |
|---|---|---|
| `legacy/` | The customer's existing Express storefront + internal catalog/inventory API | Railway (stands in for EKS/RDS) |
| `web/` | The new Next.js 16 storefront, the front door for all traffic | Vercel |
