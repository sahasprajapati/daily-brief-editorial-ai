'use client'

import { useState } from 'react'
import type { BlockDiffEntry, ContentBlock } from '@/lib/content-diff'
import type { QaSuggestion } from '@/lib/qa-suggestions'
import { ArticleAnnotator } from './ArticleAnnotator'
import { ReviewForm } from './ReviewForm'
import { VerdictForm } from './VerdictForm'

export function PieceWorkspace({
  pieceId,
  initialBlocks,
  diffEntries,
  persistedSuggestions,
}: {
  pieceId: string
  initialBlocks: ContentBlock[]
  diffEntries: BlockDiffEntry[]
  persistedSuggestions: QaSuggestion[]
}) {
  const [draftSuggestions, setDraftSuggestions] = useState<QaSuggestion[]>([])
  const [mode, setMode] = useState<'annotate' | 'edit'>('annotate')

  return (
    <>
      <div className="form-actions" style={{ justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
        <button
          type="button"
          className={mode === 'annotate' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setMode('annotate')}
        >
          Article & suggestions
        </button>
        <button
          type="button"
          className={mode === 'edit' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setMode('edit')}
        >
          Edit body
        </button>
      </div>

      {mode === 'annotate' ? (
        <div className="card">
          <ArticleAnnotator
            blocks={initialBlocks}
            draftSuggestions={draftSuggestions}
            persistedSuggestions={persistedSuggestions}
            onDraftChange={setDraftSuggestions}
            composeEnabled
          />
        </div>
      ) : (
        <ReviewForm pieceId={pieceId} initialBlocks={initialBlocks} diffEntries={diffEntries} />
      )}

      <VerdictForm
        pieceId={pieceId}
        suggestions={draftSuggestions}
        onSubmitted={() => setDraftSuggestions([])}
      />
    </>
  )
}
