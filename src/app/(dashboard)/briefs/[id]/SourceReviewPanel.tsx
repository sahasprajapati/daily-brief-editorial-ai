'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { setSourceReviewStatus } from './actions'

export type SourceHit = {
  id: string
  headline: string
  body: string
  language: string
  reviewStatus: 'candidate' | 'selected' | 'rejected'
  agency?: string
  publishedAt?: string
  priority?: string | number
}

function formatTimeToNow(iso?: string): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return ''
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function priorityClass(priority?: string | number): string {
  const n = Number(priority)
  if (n === 1) return 'nhq-prio-1'
  if (n === 2) return 'nhq-prio-2'
  if (n === 3) return 'nhq-prio-3'
  return 'nhq-prio-default'
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Sources under a topic — Reject removes a wire from the topic's generation pack. */
export function TopicSourceHits({
  briefId,
  hits,
}: {
  briefId: string
  hits: SourceHit[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const visibleHits = hits.filter((hit) => hit.reviewStatus !== 'rejected')
  if (visibleHits.length === 0) return null

  return (
    <div className="nhq-under-topic">
      <div className="nhq-under-topic-header">
        <span className="field-label" style={{ marginBottom: 0 }}>
          Sources for this topic
        </span>
        <span className="nhq-deck-count">{visibleHits.length}</span>
      </div>
      <p className="subtitle" style={{ marginBottom: '0.75rem' }}>
        These wires are used together to write the article for this topic. Reject any that do not belong.
      </p>
      {error && <div className="banner banner-error">{error}</div>}
      <ul className="nhq-source-list">
        {visibleHits.map((hit) => {
          const busy = isPending && pendingId === hit.id
          const excerpt = stripHtml(hit.body)
          return (
            <li key={hit.id} className={`nhq-source-row ${priorityClass(hit.priority)}`}>
              <div className="nhq-source-main">
                <div className="nhq-source-meta">
                  <span>{hit.agency || 'NewsHQ'}</span>
                  {hit.language && <span>· {hit.language}</span>}
                  {hit.publishedAt && <span>· {formatTimeToNow(hit.publishedAt)}</span>}
                </div>
                <div className="nhq-source-headline">{hit.headline}</div>
                {excerpt && (
                  <p className="nhq-source-excerpt">
                    {excerpt.length > 180 ? `${excerpt.slice(0, 180)}…` : excerpt}
                  </p>
                )}
              </div>
              <div className="nhq-source-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
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
                  Reject
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
