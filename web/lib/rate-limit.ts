// Best-effort, in-memory fixed-window limiter keyed by client IP. Each
// function instance keeps its own counters, so this bounds abuse per
// instance, not globally. Production: a Vercel Firewall rate-limit rule.
const windows = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(req: Request, bucket: string, { limit, windowMs }: { limit: number; windowMs: number }) {
  // On Vercel, x-forwarded-for is set by the platform.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const key = `${bucket}:${ip}`
  const now = Date.now()
  const entry = windows.get(key)
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    if (windows.size > 10_000) for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k)
    return null
  }
  if (++entry.count <= limit) return null
  return Response.json(
    { error: 'Too many requests. Try again in a moment.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) } },
  )
}
