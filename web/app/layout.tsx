import './globals.css'

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
      </body>
    </html>
  )
}
