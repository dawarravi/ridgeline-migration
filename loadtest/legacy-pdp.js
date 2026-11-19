// Load test of the LEGACY product page only (Render), never Vercel:
// Vercel allows load tests only on Enterprise plans, arranged in advance.
//
// Question it answers: what happens to the legacy store when product-page
// traffic jumps 50x (a launch, a sale), with no CDN in front of it?
//
// Assumed baseline: 2 product views/second. 50x = 100/second.
// Run: k6 run loadtest/legacy-pdp.js   (BASE_URL overrides the target)
import http from 'k6/http'
import { check } from 'k6'

const BASE = __ENV.BASE_URL || 'https://ridgeline-migration.onrender.com'
const SLUGS = ['summit-shell-jacket', 'fjord-insulated-parka', 'ridge-fleece-midlayer', 'tundra-merino-base',
  'glacier-softshell-pant', 'harbor-rain-jacket', 'aurora-down-vest', 'trail-wool-beanie']

export const options = {
  scenarios: {
    baseline: { executor: 'constant-arrival-rate', rate: 2, timeUnit: '1s', duration: '60s',
      preAllocatedVUs: 10, maxVUs: 50, tags: { phase: 'baseline' } },
    spike_50x: { executor: 'constant-arrival-rate', rate: 100, timeUnit: '1s', duration: '90s', startTime: '60s',
      preAllocatedVUs: 100, maxVUs: 400, tags: { phase: 'spike_50x' } },
  },
  thresholds: {
    // The POC's pass/fail bar for the page shoppers wait on.
    'http_req_failed{phase:spike_50x}': ['rate<0.01'],
    'http_req_duration{phase:spike_50x}': ['p(95)<2000'],
    'http_req_duration{phase:baseline}': ['p(95)<2000'],
    'http_req_failed{phase:baseline}': ['rate<0.01'],
  },
}

export default function () {
  const slug = SLUGS[Math.floor(Math.random() * SLUGS.length)]
  const res = http.get(`${BASE}/product/${slug}`, { timeout: '10s' })
  check(res, { 'status 200': (r) => r.status === 200 })
}
