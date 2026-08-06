import type { ReactNode } from 'react'
import '../globals.css'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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
