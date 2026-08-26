import { Inter } from 'next/font/google'

/** Self-hosted by Next at build time (no runtime request to Google Fonts) - exposed as a CSS
 *  variable so `globals.css` can keep a system-font fallback stack if it's ever unavailable. */
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})
