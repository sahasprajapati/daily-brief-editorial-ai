import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { checkIsAdmin, isLeadOfDesk } from '@/payload/access/admin'
import { ChannelAiForm } from './ChannelAiForm'

export default async function ChannelAiSettingsPage() {
  const user = await requireUser()
  const isAdmin = checkIsAdmin(user)
  const isLead = (user.leadOfDesks?.length ?? 0) > 0
  if (!isAdmin && !isLead) redirect('/')

  // No in-page channel picker — the header switcher (top of every page) already selects a
  // single channel, and a lead only ever sees their own channels there (getSwitcherDesks).
  // Still re-check isLeadOfDesk here, not just trust the cookie: the switcher's UI restricts
  // what a lead can pick, but the cookie itself is client-writable, and the read below has no
  // access check of its own (overrideAccess: true) - without this a tampered cookie value
  // would leak another channel's instructions to a lead who isn't cleared to see them.
  const cookieStore = await cookies()
  const selectedChannel = cookieStore.get('selected-channel')?.value ?? 'all'
  const canViewSelected = selectedChannel !== 'all' && (isAdmin || isLeadOfDesk(user, selectedChannel))

  return (
    <div className="page page-wide">
      <h1>Channel AI Instructions</h1>

      {!canViewSelected ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            {selectedChannel === 'all'
              ? 'Select a channel from the switcher above to manage its AI instructions.'
              : "You don't have access to manage AI instructions for the selected channel."}
          </p>
        </div>
      ) : (
        <ChannelAiFormLoader channelId={selectedChannel} />
      )}
    </div>
  )
}

async function ChannelAiFormLoader({ channelId }: { channelId: string }) {
  const payload = await getPayload({ config: configPromise })
  const configResult = await payload.find({
    collection: 'channel-configs',
    where: { channel: { equals: channelId } },
    limit: 1,
    overrideAccess: true,
  })
  const config = configResult.docs[0]

  return (
    <ChannelAiForm
      channelId={channelId}
      qaInstructions={config?.extraQaInstructions ?? []}
      writingInstructions={config?.extraWritingInstructions ?? []}
      majorQaFileName={config?.majorQaFileName ?? ''}
      majorQaFileText={config?.majorQaFileText ?? ''}
      majorInstructionsFileName={config?.majorInstructionsFileName ?? ''}
      majorInstructionsFileText={config?.majorInstructionsFileText ?? ''}
    />
  )
}
