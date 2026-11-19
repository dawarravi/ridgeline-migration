import './globals.css'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata = { title: 'Ridgeline' }

// Header and footer match the legacy store so shoppers can't tell which
// system served a page. Only the footer label differs, for the demo.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <a href="/">
            <b>RIDGELINE</b>
          </a>
          <a href="/">Shop</a>
          <a href="/cart">Cart</a>
        </header>
        <main>{children}</main>
        <footer>served by: new storefront (Next.js on Vercel)</footer>
        {/* Real-user Core Web Vitals (LCP, INP, CLS) for pages Next.js serves.
            Legacy pages don't load it, so the comparison with legacy uses
            lab measurements from measure/lcp.mjs. */}
        <SpeedInsights />
      </body>
    </html>
  )
}
