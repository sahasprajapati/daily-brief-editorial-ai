'use client'

import { useState } from 'react'
import Link from 'next/link'
import { StartCollectionButton } from './StartCollectionButton'
import { TopicSourceHits, type SourceHit } from './SourceReviewPanel'

export type TopicWithSources = {
  briefItemId: string
  topic: string
  sectionTitle?: string
  format?: string
  hits: SourceHit[]
}

export function SourcesStep({
  briefId,
  topics,
}: {
  briefId: string
  topics: TopicWithSources[]
}) {
  const [openId, setOpenId] = useState<string | null>(topics[0]?.briefItemId ?? null)
  const topicsWithSources = topics.filter((t) =>
    t.hits.some((h) => h.reviewStatus !== 'rejected'),
  )
  const totalHits = topicsWithSources.reduce(
    (n, t) => n + t.hits.filter((h) => h.reviewStatus !== 'rejected').length,
    0,
  )

  return (
    <div className="card">
      <h2>Step 2 — Sources</h2>
      <p className="subtitle">
        Up to 5 relevance-checked wires per topic (from multilayer NewsHQ search, limit 50 per keyword). Together they
        are the source pack for that topic’s article — reject any that do not belong.
      </p>
      <div className="nhq-search-row">
        <p className="subtitle" style={{ marginBottom: 0, flex: 1 }}>
          {totalHits > 0
            ? `${totalHits} source(s) across ${topicsWithSources.length} topic(s)`
            : 'No sources yet — run Search NewsHQ.'}
        </p>
        <StartCollectionButton briefId={briefId} />
      </div>

      {topics.map((topic) => {
        const hits = topic.hits.filter((h) => h.reviewStatus !== 'rejected')
        const open = openId === topic.briefItemId
        return (
          <div key={topic.briefItemId} className={`topic-panel${open ? ' is-open' : ''}`}>
            <button
              type="button"
              className="topic-panel-header"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : topic.briefItemId)}
            >
              <span className="topic-panel-chevron" aria-hidden>
                {open ? '▾' : '▸'}
              </span>
              {topic.sectionTitle && <span className="badge">{topic.sectionTitle}</span>}
              {topic.format && <span className="badge">{topic.format}</span>}
              <span className="topic-panel-title">{topic.topic}</span>
              {hits.length > 0 && <span className="badge">{hits.length} sources</span>}
            </button>
            {open && (
              <div className="topic-panel-body">
                <TopicSourceHits briefId={briefId} hits={hits} />
                {hits.length === 0 && (
                  <p className="subtitle" style={{ marginBottom: 0 }}>
                    No relevant sources for this topic yet.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="form-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Link href={`/briefs/${briefId}?tab=workflow&step=1`} className="btn-secondary">
          Back to parse
        </Link>
        {topicsWithSources.length > 0 ? (
          <Link href={`/briefs/${briefId}?tab=workflow&step=3`} className="btn-primary">
            Continue to generate
          </Link>
        ) : (
          <button type="button" className="btn-primary" disabled>
            Search sources to continue
          </button>
        )}
      </div>
    </div>
  )
}
