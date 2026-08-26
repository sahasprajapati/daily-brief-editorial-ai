import type { ReactNode } from 'react'
import '../globals.css'
import { inter } from '../fonts'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="shell">
          <Sidebar />
          <div className="shell-main">
            <Header />
            <main>{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
