'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { generateAllForBrief, generateForBriefItem, setSourceReviewStatus } from './actions'
import type { GenerateAllState } from './actions'
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
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [allResult, setAllResult] = useState<GenerateAllState | null>(null)

  const ready = topics.filter((t) => t.hits.length > 0)
  const pendingGenerate = ready.filter((t) => !t.pieceId)

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

  const runGenerateAll = () => {
    startTransition(async () => {
      setError(null)
      setAllResult(null)
      setIsGeneratingAll(true)
      const result = await generateAllForBrief(briefId)
      setIsGeneratingAll(false)
      if (result.error) setError(result.error)
      else setAllResult(result)
      router.refresh()
    })
  }

  return (
    <div className="card">
      <h2>Step 3 — Generate</h2>
      <div className="form-actions" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <p className="subtitle" style={{ marginTop: 0 }}>
          One article per topic, written from that topic’s source pack. Use × to drop a source before generating.
        </p>
        <button
          type="button"
          className="btn-primary"
          disabled={isGeneratingAll || isPending || pendingGenerate.length === 0}
          onClick={runGenerateAll}
          title={pendingGenerate.length === 0 ? 'Every topic with sources already has an article' : undefined}
        >
          {isGeneratingAll ? 'Generating all…' : `Generate all (${pendingGenerate.length})`}
        </button>
      </div>
      {error && <div className="banner banner-error">{error}</div>}
      {allResult && (
        <div className={`banner ${allResult.failures.length > 0 ? 'banner-error' : 'banner-success'}`}>
          Generated {allResult.generatedCount} article{allResult.generatedCount === 1 ? '' : 's'}
          {allResult.skippedCount > 0
            ? `, skipped ${allResult.skippedCount} topic${allResult.skippedCount === 1 ? '' : 's'} with no sources or an existing article`
            : ''}
          {allResult.failures.length > 0 && (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
              {allResult.failures.map((failure) => (
                <li key={failure.topic}>
                  {failure.topic}: {failure.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
