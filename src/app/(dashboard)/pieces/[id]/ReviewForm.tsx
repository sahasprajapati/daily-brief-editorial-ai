'use client'

import { useActionState, useMemo, useState } from 'react'
import { BlockEditor } from 'payload-richtext-tiptap'
// Do NOT import full styles.css (contains Tailwind preflight that breaks app UI).
import '@/vendor/payload-richtext-tiptap/styles.utilities.css'
import '@/vendor/payload-richtext-tiptap/article-custom.css'
import type { BlockDiffEntry, ContentBlock } from '@/lib/content-diff'
import { contentBlocksToTiptap, tiptapToContentBlocks, type TiptapDoc } from '@/lib/content-diff/tiptap'
import { saveBody } from './actions'

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
  const initialDoc = useMemo(() => contentBlocksToTiptap(initialBlocks), [initialBlocks])
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
            Same TipTap editor as cms-prod. Formatting is preserved in the editor; QA still anchors on
            plain-text blocks.
          </p>
          <div className="tiptap-review-editor">
            <BlockEditor
              // Package types require html+json; we only round-trip TipTap JSON.
              content={{ html: '', json: initialDoc }}
              hasCollab={false}
              isEditable
              autoFocus={false}
              dir="ltr"
              additionalContext={{ language: 'en', translations: {} }}
              handleChange={(value) => {
                const doc = (value?.json ?? value) as TiptapDoc
                setBlocks(tiptapToContentBlocks(doc))
              }}
            />
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
