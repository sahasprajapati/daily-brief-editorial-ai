'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export interface SidebarItem {
  href: string
  label: string
  icon: ReactNode
}

/** Client-only because active-route highlighting needs usePathname - auth/role gating stays
 *  in the (server) Sidebar component, which decides which items to pass in. */
export function SidebarNav({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="sidebar-nav">
      {items.map((item) => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link${isActive ? ' is-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
