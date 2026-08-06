import { cookies } from 'next/headers'
import { requireUser } from '@/payload/auth/session'
import { getSwitcherDesks } from '@/lib/desks'
import { ChannelSwitcher } from './ChannelSwitcher'
import { LogoutButton } from './LogoutButton'

export async function Header() {
  const user = await requireUser()
  const desks = await getSwitcherDesks(user)
  const hasAnyLead = (user.leadOfDesks?.length ?? 0) > 0
  const showAllOption = user.role === 'admin' || !hasAnyLead
  const cookieStore = await cookies()
  const selected = cookieStore.get('selected-channel')?.value ?? (showAllOption ? 'all' : (desks[0]?.id ?? 'all'))

  return (
    <header className="shell-header">
      <span className="email">{user.email}</span>
      <ChannelSwitcher desks={desks} selected={selected} showAllOption={showAllOption} />
      <LogoutButton />
    </header>
  )
}
