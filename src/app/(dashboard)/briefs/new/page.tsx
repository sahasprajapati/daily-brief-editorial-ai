import { cookies } from 'next/headers'
import { requireUser } from '@/payload/auth/session'
import { getLeadDesks } from '@/lib/desks'
import { UploadForm } from './UploadForm'

export default async function NewBriefPage() {
  const user = await requireUser()
  const desks = await getLeadDesks(user)
  const cookieStore = await cookies()
  const selectedChannel = cookieStore.get('selected-channel')?.value ?? 'all'

  if (selectedChannel === 'all') {
    return (
      <div className="page">
        <h1>Upload daily brief</h1>
        <div className="card upload-disabled-panel">
          <h2>Upload disabled</h2>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Select a specific channel in the header first — briefs are uploaded per channel.
          </p>
        </div>
      </div>
    )
  }

  const channel = desks.find((desk) => desk.id === selectedChannel)
  if (!channel) {
    return (
      <div className="page">
        <h1>Upload daily brief</h1>
        <div className="channel-chip" title={selectedChannel}>
          Channel · {selectedChannel}
        </div>
        <div className="card upload-disabled-panel">
          <h2>Upload disabled</h2>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            You are not a lead on this channel, so upload is disabled. Ask an admin to add this
            channel to your lead desks, or switch to a channel you lead.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Upload daily brief</h1>
      <div className="channel-chip" title={channel.id}>
        Channel · {channel.name}
      </div>
      <div className="card">
        <h2>Source</h2>
        <UploadForm channel={channel} />
      </div>
    </div>
  )
}
