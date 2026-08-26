'use client'

import { useActionState, useState } from 'react'
import type { BlockDiffEntry, ContentBlock } from '@/lib/content-diff'
import { saveBody } from './actions'

// TEMP: payload-richtext-tiptap requires a paid TipTap Pro registry token
// (TIPTAP_AUTH_TOKEN) that isn't available in this dev environment. Swapped
// in a plain-textarea block editor so the rest of the app is workable.
// Restore the real BlockEditor once TIPTAP_AUTH_TOKEN is set — see README.

type SaveState = { error: string | null }

const initialState: SaveState = { error: null }

export function ReviewForm({
  pieceId,
  initialBlocks,
  diffEntries,
}: {
  pieceId: string
  initialBlocks: ContentBlock[]
  diffEntries: BlockDiffEntry[]
}) {
  const [showDiff, setShowDiff] = useState(false)
  const [blocks, setBlocks] = useState(initialBlocks)
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    () => saveBody(pieceId, blocks),
    initialState,
  )

  return (
    <div className="card">
      <div className="form-actions" style={{ justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
        <button type="button" className="btn-secondary" onClick={() => setShowDiff((value) => !value)}>
          {showDiff ? 'Hide changes' : 'View changes'}
        </button>
      </div>

      {showDiff ? (
        <ul className="list" style={{ marginTop: '1rem' }}>
          {diffEntries.map((entry) => (
            <li key={entry.blockId} className={`list-item diff-${entry.status}`}>
              {entry.status === 'changed' && entry.diffHtml ? (
                <span dangerouslySetInnerHTML={{ __html: entry.diffHtml }} />
              ) : (
                <span>{entry.text}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <form action={formAction} className="tiptap-review-form">
          <p className="subtitle" style={{ marginTop: 0 }}>
            Plain-text block editor (TipTap Pro editor disabled — no TIPTAP_AUTH_TOKEN in this
            environment). QA still anchors on these same plain-text blocks.
          </p>
          <div className="tiptap-review-editor" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {blocks.map((block, index) => (
              <textarea
                key={block.blockId}
                value={block.text}
                onChange={(e) => {
                  const text = e.target.value
                  setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, text } : b)))
                }}
                rows={block.type === 'heading' ? 2 : 4}
                className={block.type === 'heading' ? 'input input-heading' : 'input'}
                style={{ width: '100%', fontFamily: 'inherit' }}
              />
            ))}
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
          {state.error && (
            <div className="banner banner-error" style={{ marginTop: '0.75rem' }}>
              {state.error}
            </div>
          )}
        </form>
      )}
    </div>
  )
}
