import type { ReactNode } from 'react'
import '../globals.css'
import { inter } from '../fonts'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
