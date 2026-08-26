import Link from 'next/link'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { resolveUploadChannel } from '@/lib/desks'
import { UploadBriefButton } from '../UploadBriefButton'

export default async function BriefsPage() {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })
  const cookieStore = await cookies()
  const selectedChannel = cookieStore.get('selected-channel')?.value ?? 'all'
  const { channel: uploadChannel, reason: uploadDisabledReason } = await resolveUploadChannel(
    user,
    selectedChannel,
  )

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
      <div className="page-header">
        <div>
          <h1>Briefs</h1>
          <p className="subtitle">
            {selectedChannel === 'all' ? 'All channels' : 'Scoped to selected channel'}
          </p>
        </div>
        <UploadBriefButton
          channel={uploadChannel}
          reason={uploadDisabledReason}
          className="btn-secondary page-header-btn"
          label="Upload a new brief"
        />
      </div>
      <div className="card">
        {briefs.docs.length === 0 ? (
          <p>No briefs yet{selectedChannel !== 'all' ? ' for this channel' : ''}.</p>
        ) : (
          <div className="recent-briefs-list">
            {briefs.docs.map((brief) => (
              <div key={brief.id} className="recent-brief-row">
                <span className="recent-brief-icon">
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M4 1.5h5.5L13 5v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                    <path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="recent-brief-main">
                  <div className="recent-brief-title">{brief.title}</div>
                  <div className="recent-brief-meta">
                    <span>{formatBriefDate(brief.createdAt)}</span>
                    <span className="dot" />
                    <span>v{brief.version}</span>
                  </div>
                </span>
                <span className={`status-badge status-badge-${brief.status}`}>{BRIEF_STATUS_LABEL[brief.status]}</span>
                <Link href={`/briefs/${brief.id}`} className="btn-secondary brief-row-open">
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const BRIEF_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  parsed: 'Parsed',
  confirmed: 'Confirmed',
  superseded: 'Superseded',
}

function formatBriefDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
