import { getCmsClient } from './cms-client/instance'
import type { User } from '@/payload-types'

export interface Desk {
  id: string
  name: string
}

/** CMS_BASE_URL/CMS_API_KEY may be unset or unreachable (e.g. in local dev before real
 *  cms-prod credentials are configured). createCmsClient stubs listChannels with the
 *  local channel seed in that case; this catch is a last-resort empty list. */
async function fetchChannelsSafely(): Promise<Desk[]> {
  try {
    return await getCmsClient().listChannels()
  } catch {
    return []
  }
}

/** Desks this user may upload/confirm briefs for: admins get everything, everyone else only
 *  the desks in their own leadOfDesks - independent of role, there's no separate 'lead' role. */
export async function getLeadDesks(user: User): Promise<Desk[]> {
  const channels = await fetchChannelsSafely()
  if (user.role === 'admin') return channels
  const leadOfDesks = user.leadOfDesks ?? []
  return channels.filter((channel) => leadOfDesks.includes(channel.id))
}

/** Desks this user may pick in the header channel switcher: a lead (non-empty leadOfDesks) is
 *  restricted to their own desks, matching the upload gate; everyone else (admin, or a plain
 *  editor with no lead assignments) sees the full list. */
export async function getSwitcherDesks(user: User): Promise<Desk[]> {
  const channels = await fetchChannelsSafely()
  if (user.role === 'admin') return channels
  const leadOfDesks = user.leadOfDesks ?? []
  if (leadOfDesks.length > 0) return channels.filter((channel) => leadOfDesks.includes(channel.id))
  return channels
}
