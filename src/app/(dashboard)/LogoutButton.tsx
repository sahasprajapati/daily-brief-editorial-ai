'use client'

import { useTransition } from 'react'
import { logout } from './shell-actions'

export function LogoutButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button type="button" disabled={isPending} onClick={() => startTransition(() => logout())}>
      {isPending ? 'Signing out…' : 'Log out'}
    </button>
  )
}
