'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setSelectedChannel } from './shell-actions'
import type { Desk } from '@/lib/desks'

export function ChannelSwitcher({
  desks,
  selected,
  showAllOption,
}: {
  desks: Desk[]
  selected: string
  showAllOption: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <select
      value={selected}
      disabled={isPending}
      onChange={(event) => {
        const value = event.target.value
        startTransition(async () => {
          await setSelectedChannel(value)
          router.refresh()
        })
      }}
    >
      {showAllOption && <option value="all">All channels</option>}
      {desks.map((desk) => (
        <option key={desk.id} value={desk.id}>
          {desk.name}
        </option>
      ))}
    </select>
  )
}
