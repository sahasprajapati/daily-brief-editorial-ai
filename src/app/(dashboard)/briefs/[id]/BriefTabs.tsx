'use client'

import Link from 'next/link'

export function BriefTabs({
  briefId,
  tab,
  articleCount,
}: {
  briefId: string
  tab: 'workflow' | 'articles'
  articleCount: number
}) {
  return (
    <div className="mode-tabs brief-page-tabs" role="tablist" aria-label="Brief views">
      <Link
        href={`/briefs/${briefId}?tab=workflow`}
        role="tab"
        aria-selected={tab === 'workflow'}
        className={`mode-tab${tab === 'workflow' ? ' is-active' : ''}`}
      >
        Workflow
      </Link>
      <Link
        href={`/briefs/${briefId}?tab=articles`}
        role="tab"
        aria-selected={tab === 'articles'}
        className={`mode-tab${tab === 'articles' ? ' is-active' : ''}`}
      >
        Articles{articleCount > 0 ? ` (${articleCount})` : ''}
      </Link>
    </div>
  )
}
