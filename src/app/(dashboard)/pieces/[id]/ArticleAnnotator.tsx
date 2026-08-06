'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { ContentBlock } from '@/lib/content-diff'
import {
  resolveSuggestionAnchors,
  type QaSuggestion,
  type ResolvedSuggestionAnchor,
  type SuggestionSeverity,
} from '@/lib/qa-suggestions'

type PendingSelection = {
  blockId: string
  startOffset: number
  endOffset: number
  quote: string
  top: number
  left: number
}

function selectionWithinBlock():
  | { ok: true; blockId: string; startOffset: number; endOffset: number; quote: string }
  | { ok: false; reason: 'empty' | 'cross-block' } {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return { ok: false, reason: 'empty' }

  const range = sel.getRangeAt(0)
  const startNode =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : (range.startContainer as Element)
  const endNode =
    range.endContainer.nodeType === Node.TEXT_NODE
      ? range.endContainer.parentElement
      : (range.endContainer as Element)

  const startBlock = startNode?.closest('[data-block-id]') as HTMLElement | null
  const endBlock = endNode?.closest('[data-block-id]') as HTMLElement | null
  if (!startBlock || !endBlock) return { ok: false, reason: 'empty' }
  if (startBlock !== endBlock) return { ok: false, reason: 'cross-block' }

  const blockId = startBlock.dataset.blockId
  if (!blockId) return { ok: false, reason: 'empty' }

  const offsets = offsetsInBlock(startBlock, range)
  if (!offsets) return { ok: false, reason: 'empty' }
  const quote = sel.toString()
  if (!quote.trim()) return { ok: false, reason: 'empty' }

  return {
    ok: true,
    blockId,
    startOffset: offsets.start,
    endOffset: offsets.end,
    quote,
  }
}

function offsetsInBlock(blockEl: HTMLElement, range: Range): { start: number; end: number } | null {
  const preStart = document.createRange()
  preStart.selectNodeContents(blockEl)
  preStart.setEnd(range.startContainer, range.startOffset)
  const start = preStart.toString().length

  const preEnd = document.createRange()
  preEnd.selectNodeContents(blockEl)
  preEnd.setEnd(range.endContainer, range.endOffset)
  const end = preEnd.toString().length

  if (end <= start) return null
  return { start, end }
}

function renderBlockText(
  text: string,
  anchors: ResolvedSuggestionAnchor[],
  focusedId: string | null,
): ReactNode {
  if (anchors.length === 0) return text

  const sorted = [...anchors]
    .filter((a) => a.status !== 'orphaned')
    .sort((a, b) => a.startOffset - b.startOffset)

  const parts: ReactNode[] = []
  let cursor = 0
  for (const anchor of sorted) {
    const start = Math.max(0, Math.min(anchor.startOffset, text.length))
    const end = Math.max(start, Math.min(anchor.endOffset, text.length))
    if (start < cursor) continue
    if (start > cursor) parts.push(text.slice(cursor, start))
    const className = [
      'qa-highlight',
      `qa-highlight-${anchor.status}`,
      `qa-highlight-${anchor.suggestion.severity}`,
      focusedId === anchor.suggestion.id ? 'is-focused' : '',
    ]
      .filter(Boolean)
      .join(' ')
    parts.push(
      <mark key={anchor.suggestion.id} id={`qa-mark-${anchor.suggestion.id}`} className={className}>
        {text.slice(start, end) || ' '}
      </mark>,
    )
    cursor = end
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

export function ArticleAnnotator({
  blocks,
  draftSuggestions,
  persistedSuggestions,
  onDraftChange,
  composeEnabled,
}: {
  blocks: ContentBlock[]
  draftSuggestions: QaSuggestion[]
  persistedSuggestions: QaSuggestion[]
  onDraftChange: (next: QaSuggestion[]) => void
  composeEnabled: boolean
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingSelection | null>(null)
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<SuggestionSeverity>('softFail')
  const [selectError, setSelectError] = useState<string | null>(null)

  const displaySuggestions = useMemo(
    () => [...persistedSuggestions, ...draftSuggestions],
    [persistedSuggestions, draftSuggestions],
  )
  const anchors = useMemo(
    () => resolveSuggestionAnchors(blocks, displaySuggestions),
    [blocks, displaySuggestions],
  )
  const anchorsByBlock = useMemo(() => {
    const map = new Map<string, ResolvedSuggestionAnchor[]>()
    for (const anchor of anchors) {
      if (anchor.status === 'orphaned') continue
      const list = map.get(anchor.suggestion.blockId) ?? []
      list.push(anchor)
      map.set(anchor.suggestion.blockId, list)
    }
    return map
  }, [anchors])

  const handleMouseUp = useCallback(() => {
    if (!composeEnabled) return
    const result = selectionWithinBlock()
    if (!result.ok) {
      if (result.reason === 'cross-block') {
        setSelectError('Select text within one paragraph.')
        setPending(null)
      }
      return
    }
    setSelectError(null)
    const sel = window.getSelection()
    const range = sel?.getRangeAt(0)
    const rect = range?.getBoundingClientRect()
    setPending({
      blockId: result.blockId,
      startOffset: result.startOffset,
      endOffset: result.endOffset,
      quote: result.quote,
      top: (rect?.bottom ?? 0) + 8,
      left: Math.min(rect?.left ?? 16, window.innerWidth - 360),
    })
    setMessage('')
    setSeverity('softFail')
  }, [composeEnabled])

  function addSuggestion() {
    if (!pending || !message.trim()) return
    const next: QaSuggestion = {
      id: crypto.randomUUID(),
      quote: pending.quote,
      message: message.trim(),
      severity,
      blockId: pending.blockId,
      startOffset: pending.startOffset,
      endOffset: pending.endOffset,
      createdAt: new Date().toISOString(),
    }
    onDraftChange([...draftSuggestions, next])
    setPending(null)
    setFocusedId(next.id)
    window.getSelection()?.removeAllRanges()
  }

  function removeDraft(id: string) {
    onDraftChange(draftSuggestions.filter((s) => s.id !== id))
  }

  function focusSuggestion(id: string) {
    setFocusedId(id)
    document.getElementById(`qa-mark-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="qa-annotator">
      <div className="qa-annotator-main">
        {composeEnabled && (
          <p className="subtitle" style={{ marginTop: 0 }}>
            Select text in the article to add a suggestion (one paragraph at a time).
          </p>
        )}
        {selectError && <div className="banner banner-warn">{selectError}</div>}

        <article className="qa-article" onMouseUp={handleMouseUp}>
          {blocks.map((block) => {
            const Tag = block.type === 'heading' ? 'h2' : 'p'
            return (
              <Tag key={block.blockId} data-block-id={block.blockId} className={`qa-block qa-block-${block.type}`}>
                {renderBlockText(block.text, anchorsByBlock.get(block.blockId) ?? [], focusedId)}
              </Tag>
            )
          })}
        </article>

        {pending && (
          <div className="qa-composer" style={{ top: pending.top, left: pending.left }}>
            <p className="qa-composer-quote">“{pending.quote}”</p>
            <label className="field-label" htmlFor="qa-suggestion-message">
              Suggestion
            </label>
            <textarea
              id="qa-suggestion-message"
              className="field-input"
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What should the editor change?"
              autoFocus
            />
            <label className="field-label" htmlFor="qa-suggestion-severity">
              Severity
            </label>
            <select
              id="qa-suggestion-severity"
              className="field-input"
              value={severity}
              onChange={(event) => setSeverity(event.target.value as SuggestionSeverity)}
            >
              <option value="softFail">Suggestion</option>
              <option value="hardFail">Must fix</option>
            </select>
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button type="button" className="btn-secondary" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={!message.trim()} onClick={addSuggestion}>
                Add suggestion
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="qa-sidebar">
        <h3>Suggestions</h3>
        {persistedSuggestions.length > 0 && draftSuggestions.length > 0 && (
          <p className="subtitle">Draft notes below will be saved with the next verdict.</p>
        )}
        {anchors.length === 0 ? (
          <p className="subtitle">No suggestions yet.</p>
        ) : (
          <ul className="qa-sidebar-list">
            {anchors.map((anchor) => {
              const isDraft = draftSuggestions.some((d) => d.id === anchor.suggestion.id)
              return (
                <li key={anchor.suggestion.id}>
                  <button
                    type="button"
                    className={`qa-sidebar-item${focusedId === anchor.suggestion.id ? ' is-focused' : ''}`}
                    onClick={() => focusSuggestion(anchor.suggestion.id)}
                  >
                    <span className="qa-sidebar-meta">
                      {anchor.suggestion.severity === 'hardFail' ? 'Must fix' : 'Suggestion'}
                      {anchor.status === 'text-changed' && (
                        <span className="badge" style={{ marginLeft: '0.35rem' }}>
                          Text changed
                        </span>
                      )}
                      {anchor.status === 'orphaned' && (
                        <span className="badge" style={{ marginLeft: '0.35rem' }}>
                          Block removed
                        </span>
                      )}
                      {isDraft && (
                        <span className="badge" style={{ marginLeft: '0.35rem' }}>
                          Draft
                        </span>
                      )}
                    </span>
                    <span className="qa-sidebar-quote">“{anchor.suggestion.quote}”</span>
                    <span className="qa-sidebar-message">{anchor.suggestion.message}</span>
                  </button>
                  {isDraft && (
                    <button type="button" className="btn-link" onClick={() => removeDraft(anchor.suggestion.id)}>
                      Remove
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </aside>
    </div>
  )
}
