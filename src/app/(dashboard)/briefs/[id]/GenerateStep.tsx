'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { generateForBriefItem, setSourceReviewStatus } from './actions'
import type { SourceHit } from './SourceReviewPanel'

export type TopicGenerateRow = {
  briefItemId: string
  topic: string
  hits: SourceHit[]
  pieceId?: string
}

export function GenerateStep({
  briefId,
  topics,
}: {
  briefId: string
  topics: TopicGenerateRow[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const ready = topics.filter((t) => t.hits.length > 0)

  if (ready.length === 0) {
    return (
      <div className="card">
        <h2>Step 3 — Generate</h2>
        <p className="subtitle">Add sources under topics in step 2 before generating articles.</p>
        <Link href={`/briefs/${briefId}?tab=workflow&step=2`} className="btn-primary">
          Back to sources
        </Link>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Step 3 — Generate</h2>
      <p className="subtitle">
        One article per topic, written from that topic’s source pack. Use × to drop a source before generating.
      </p>
      {error && <div className="banner banner-error">{error}</div>}
      <ul className="nhq-source-list">
        {ready.map((topic) => {
          const busy = isPending && pendingId === topic.briefItemId
          return (
            <li key={topic.briefItemId} className="nhq-source-row">
              <div className="nhq-source-main">
                <div className="nhq-source-headline">{topic.topic}</div>
                <div className="nhq-source-meta" style={{ marginTop: '0.35rem' }}>
                  <span>{topic.hits.length} source(s)</span>
                  {topic.pieceId && <span>· article ready</span>}
                </div>
                <ul className="nhq-generate-sources">
                  {topic.hits.map((hit) => {
                    const rejecting = isPending && pendingId === hit.id
                    return (
                      <li key={hit.id} className="nhq-generate-source">
                        <span className="nhq-generate-source-text">
                          {hit.agency ? `${hit.agency}: ` : ''}
                          {hit.headline}
                        </span>
                        <button
                          type="button"
                          className="nhq-source-dismiss"
                          aria-label={`Remove source: ${hit.headline}`}
                          disabled={rejecting || busy}
                          title="Remove from source pack"
                          onClick={() =>
                            startTransition(async () => {
                              setError(null)
                              setPendingId(hit.id)
                              const result = await setSourceReviewStatus(hit.id, briefId, 'rejected')
                              setPendingId(null)
                              if (result.error) setError(result.error)
                              else router.refresh()
                            })
                          }
                        >
                          ×
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div className="nhq-source-actions">
                {topic.pieceId && (
                  <Link href={`/pieces/${topic.pieceId}`} className="btn-secondary">
                    View article
                  </Link>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || topic.hits.length === 0}
                  onClick={() =>
                    startTransition(async () => {
                      setError(null)
                      setPendingId(topic.briefItemId)
                      const result = await generateForBriefItem(topic.briefItemId, briefId)
                      setPendingId(null)
                      if (result.error) setError(result.error)
                      else if (result.pieceId) router.push(`/pieces/${result.pieceId}`)
                      else router.refresh()
                    })
                  }
                >
                  {busy ? 'Generating…' : topic.pieceId ? 'Regenerate' : 'Generate article'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="form-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Link href={`/briefs/${briefId}?tab=workflow&step=2`} className="btn-secondary">
          Back to sources
        </Link>
        <Link href={`/briefs/${briefId}?tab=articles`} className="btn-link">
          View all articles
        </Link>
      </div>
    </div>
  )
}
