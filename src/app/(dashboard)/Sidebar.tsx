import Link from 'next/link'
import { requireUser } from '@/payload/auth/session'

export async function Sidebar() {
  const user = await requireUser()

  return (
    <nav className="sidebar">
      <Link href="/">Dashboard</Link>
      <Link href="/briefs">Briefs</Link>
      {user.role === 'admin' && <Link href="/settings/newshq">NewsHQ settings</Link>}
      {user.role === 'admin' && <a href="/admin">Open admin panel</a>}
    </nav>
  )
}
