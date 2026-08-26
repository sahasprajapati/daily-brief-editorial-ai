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

export interface UploadChannelResolution {
  channel: Desk | null
  /** Set (with `channel` null) when upload is currently unavailable — no channel selected,
   *  or the user isn't a lead on the selected one. Shown as-is in the upload UI. */
  reason: string | null
}

/** Resolves whether the given user can upload a brief for the currently selected channel -
 *  shared by every upload entry point (dashboard button, briefs list) so they agree on the
 *  same disabled-state messaging instead of each re-deriving it. */
export async function resolveUploadChannel(
  user: User,
  selectedChannel: string,
): Promise<UploadChannelResolution> {
  if (selectedChannel === 'all') {
    return {
      channel: null,
      reason: 'Select a specific channel in the header first — briefs are uploaded per channel.',
    }
  }
  const desks = await getLeadDesks(user)
  const channel = desks.find((desk) => desk.id === selectedChannel)
  if (!channel) {
    return {
      channel: null,
      reason:
        'You are not a lead on this channel, so upload is disabled. Ask an admin to add this channel to your lead desks, or switch to a channel you lead.',
    }
  }
  return { channel, reason: null }
}
