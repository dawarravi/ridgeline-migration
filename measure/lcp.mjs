// Lab LCP/FCP/TTFB for both A/B variants in headless Chrome via raw CDP (no deps).
// Usage: node measure/lcp.mjs <visitor-id-bucketed-new> <visitor-id-bucketed-legacy> [runs]
// Get IDs by requesting a product page and reading the rl_vid cookie + x-ridgeline-variant header.
import { spawn } from 'node:child_process'
const [ , , NEW, LEG, RUNS = '6' ] = process.argv
const URL_ = 'https://ridgeline-migration.vercel.app/product/summit-shell-jacket'
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + process.env.TMPDIR + '/lcp-profile', '--no-first-run'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ver; for (let i = 0; i < 40 && !ver; i++) { try { ver = await (await fetch('http://127.0.0.1:9333/json/version')).json() } catch { await sleep(250) } }
const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); const events = []
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } else events.push(d) }
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })) })
const out = { new: [], legacy: [] }
for (const [variant, vid] of [['new', NEW], ['legacy', LEG]]) {
  for (let i = 0; i < Number(RUNS); i++) {
    const { result: { browserContextId } } = await send('Target.createBrowserContext')
    const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
    const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true })
    await send('Network.enable', {}, sessionId); await send('Page.enable', {}, sessionId)
    await send('Network.setCookie', { name: 'rl_vid', value: vid, domain: 'ridgeline-migration.vercel.app', path: '/', secure: true, httpOnly: true }, sessionId)
    await send('Page.navigate', { url: URL_ }, sessionId)
    for (let t = 0; t < 60 && !events.some((e) => e.sessionId === sessionId && e.method === 'Page.loadEventFired'); t++) await sleep(250)
    await sleep(1500) // let LCP settle
    const expr = `new Promise(r=>new PerformanceObserver(l=>{const e=l.getEntries();const n=performance.getEntriesByType('navigation')[0];r(JSON.stringify({lcp:Math.round(e[e.length-1].startTime),fcp:Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime??-1),ttfb:Math.round(n.responseStart),footer:document.querySelector('footer')?.textContent.slice(12,30)}))}).observe({type:'largest-contentful-paint',buffered:true}))`
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId)
    out[variant].push(JSON.parse(r.result.result.value))
    await send('Target.disposeBrowserContext', { browserContextId })
  }
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
for (const v of ['new', 'legacy']) console.log(v, JSON.stringify(out[v].map((x) => x.footer))[0] ? '' : '', 'median', JSON.stringify({ ttfb: med(out[v].map((x) => x.ttfb)), fcp: med(out[v].map((x) => x.fcp)), lcp: med(out[v].map((x) => x.lcp)) }), 'served-by', out[v][0].footer, 'all-lcp', out[v].map((x) => x.lcp).join(','))
ws.close(); chrome.kill()
