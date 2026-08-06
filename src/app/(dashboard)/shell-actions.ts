'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function setSelectedChannel(channelId: string): Promise<void> {
  ;(await cookies()).set('selected-channel', channelId, { path: '/', sameSite: 'lax' })
}

export async function logout(): Promise<void> {
  ;(await cookies()).delete('payload-token')
  redirect('/login')
}
