import { requireUser } from '@/payload/auth/session'
import { SidebarNav, type SidebarItem } from './SidebarNav'
import { DashboardIcon, BriefsIcon, NewsHqIcon, ChannelAiIcon } from './SidebarIcons'

export async function Sidebar() {
  const user = await requireUser()
  const isAdmin = user.role === 'admin'
  const isChannelLead = (user.leadOfDesks?.length ?? 0) > 0

  const items: SidebarItem[] = [
    { href: '/', label: 'Dashboard', icon: <DashboardIcon /> },
    { href: '/briefs', label: 'Briefs', icon: <BriefsIcon /> },
    ...(isAdmin ? [{ href: '/settings/newshq', label: 'Sources', icon: <NewsHqIcon /> }] : []),
    // Channel AI Instructions: visible to tool admins and to any channel lead (leadOfDesks),
    // not gated to admin-only - a lead manages their own channel's instructions here.
    ...(isAdmin || isChannelLead
      ? [{ href: '/settings/channel-ai', label: 'Instructions', icon: <ChannelAiIcon /> }]
      : []),
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark">TN</span>
        <span className="sidebar-brand-name">Newsroom AI</span>
      </div>
      <SidebarNav items={items} />
    </aside>
  )
}
