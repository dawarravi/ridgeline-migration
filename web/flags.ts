import { createHash } from 'node:crypto'
import { flag } from 'flags/next'
import { get } from '@vercel/global-config'

// Horizontal migration: instead of moving the product page for everyone at
// once, send a percentage of shoppers to the new page and keep the rest on
// legacy. The percentage and the kill switch live in Global Config, so they
// change in seconds without a redeploy.
//
// Global Config item `pdpRollout`: { "enabled": true, "percentNew": 50 }

export const VISITOR_COOKIE = 'rl_vid'

type Rollout = { enabled?: boolean; percentNew?: number }

// Sticky assignment: the same visitor ID always lands in the same bucket
// (0-99), so a shopper doesn't flip between old and new pages on each click.
// Raising percentNew from 10 to 50 keeps the first 10% where they were.
function bucket(visitorId: string) {
  return createHash('sha256').update(`new-product-page:${visitorId}`).digest().readUInt32BE(0) % 100
}

export const newProductPage = flag<boolean, { visitorId: string }>({
  key: 'new-product-page',
  description: 'Serve the product page from the new Next.js storefront instead of legacy',
  options: [
    { value: false, label: 'Legacy' },
    { value: true, label: 'New' },
  ],
  // Fail safe: if Global Config can't be read, decide() throws and every
  // shopper gets legacy, the version we know works.
  defaultValue: false,
  identify({ cookies }) {
    const visitorId = cookies.get(VISITOR_COOKIE)?.value
    return visitorId ? { visitorId } : undefined
  },
  async decide({ entities }) {
    const rollout = await get<Rollout>('pdpRollout')
    if (!rollout?.enabled || !entities) return false
    const percent = Math.min(100, Math.max(0, Number(rollout.percentNew) || 0))
    return bucket(entities.visitorId) < percent
  },
})
