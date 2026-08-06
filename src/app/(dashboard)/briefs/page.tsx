import Link from 'next/link'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { checkIsAdmin, isLeadOfDesk } from '@/payload/access/admin'
import { getLeadDesks } from '@/lib/desks'

export default async function BriefsPage() {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })
  const cookieStore = await cookies()
  const selectedChannel = cookieStore.get('selected-channel')?.value ?? 'all'
  const leadDesks = await getLeadDesks(user)

  const canUpload =
    selectedChannel !== 'all' &&
    (checkIsAdmin(user) || isLeadOfDesk(user, selectedChannel)) &&
    leadDesks.some((desk) => desk.id === selectedChannel)

  const briefs = await payload.find({
    collection: 'editorial-briefs',
    where: {
      and: [
        { status: { not_equals: 'superseded' } },
        ...(selectedChannel === 'all' ? [] : [{ channel: { equals: selectedChannel } }]),
      ],
    },
    sort: '-createdAt',
    limit: 50,
    overrideAccess: false,
    user,
  })

  return (
    <div className="page">
      <h1>Briefs</h1>
      <p className="subtitle">
        {canUpload ? (
          <Link href="/briefs/new">Upload a new brief</Link>
        ) : (
          <span className="upload-disabled" title="Select a channel you lead to upload">
            Upload a new brief
          </span>
        )}
        {selectedChannel !== 'all' && <> — scoped to selected channel</>}
        {!canUpload && selectedChannel !== 'all' && (
          <> — upload disabled (not a lead on this channel)</>
        )}
        {selectedChannel === 'all' && <> — pick a channel to upload</>}
      </p>
      <div className="card">
        {briefs.docs.length === 0 ? (
          <p>No briefs yet{selectedChannel !== 'all' ? ' for this channel' : ''}.</p>
        ) : (
          <ul className="list">
            {briefs.docs.map((brief) => (
              <li key={brief.id} className="list-item">
                <span>
                  {brief.title} — {brief.channelName ?? brief.channel}
                </span>
                <span>
                  <span className="badge">{brief.status}</span> <Link href={`/briefs/${brief.id}`}>Open</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
