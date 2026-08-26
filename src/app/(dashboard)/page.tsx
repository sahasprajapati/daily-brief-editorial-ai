import Link from 'next/link'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'

function DocIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 1.5h5.5L13 5v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

/** One finished batch of editorial output: a brief that has produced at least one generated
 *  article. Not called a "brief" in the UI - by the time it has articles, it's the result of
 *  the whole collect → generate → QA pipeline, not just an uploaded document. */
interface EditorialOutput {
  briefId: string
  title: string
  createdAt: string
  articleCount: number
}

async function loadRecentEditorialOutput(
  selectedChannel: string,
  user: Awaited<ReturnType<typeof requireUser>>,
): Promise<EditorialOutput[]> {
  const payload = await getPayload({ config: configPromise })

  const briefs = await payload.find({
    collection: 'editorial-briefs',
    where: {
      and: [
        { status: { not_equals: 'superseded' } },
        ...(selectedChannel === 'all' ? [] : [{ channel: { equals: selectedChannel } }]),
      ],
    },
    sort: '-createdAt',
    // Candidates, not the final list - only briefs that actually produced articles count as
    // "output", so we may need to look past a few empty/in-progress ones to fill the list.
    limit: 25,
    overrideAccess: false,
    user,
  })

  const output: EditorialOutput[] = []
  for (const brief of briefs.docs) {
    const pieces = await payload.find({
      collection: 'generated-pieces',
      where: { brief: { equals: brief.id } },
      limit: 0,
      overrideAccess: true,
    })
    if (pieces.totalDocs === 0) continue
    output.push({
      briefId: brief.id,
      title: brief.title,
      createdAt: brief.createdAt,
      articleCount: pieces.totalDocs,
    })
    if (output.length >= 8) break
  }
  return output
}

function formatOutputDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function DashboardPage() {
  const user = await requireUser()
  const cookieStore = await cookies()
  const selectedChannel = cookieStore.get('selected-channel')?.value ?? 'all'
  const editorialOutput = await loadRecentEditorialOutput(selectedChannel, user)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Editorial Assistant</h1>
          <p className="subtitle">Signed in as {user.email}</p>
        </div>
      </div>

      <div className="card">
        <h2>Recent editorial output</h2>
        {editorialOutput.length === 0 ? (
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Nothing generated yet{selectedChannel !== 'all' ? ' for this channel' : ''}. Articles show up here once a
            brief has gone through collection and generation.
          </p>
        ) : (
          <div className="recent-briefs-list">
            {editorialOutput.map((output) => (
              <Link key={output.briefId} href={`/output/${output.briefId}`} className="recent-brief-row">
                <span className="recent-brief-icon">
                  <DocIcon />
                </span>
                <span className="recent-brief-main">
                  <div className="recent-brief-title">{output.title}</div>
                  <div className="recent-brief-meta">
                    <span>{formatOutputDate(output.createdAt)}</span>
                    <span className="dot" />
                    <span>
                      {output.articleCount} article{output.articleCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
