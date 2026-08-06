'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { BriefItemDiffEntry } from '@/lib/brief-diff'
import { saveBriefItems, confirmBrief } from './actions'

type EditableItem = {
  id?: string
  topic: string
  sectionTitle: string
  format: string
  angle: string
  priorityOrder: number
  region: string
  keywords: string[]
  exclusions: string[]
  sentiment: string
  portrayalNotes: string
  bannedTerms: string[]
  requiredContext: string
}

function ArrayField({
  values,
  onChange,
}: {
  values: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div>
      {values.map((value, index) => (
        <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            className="field-input"
            style={{ marginBottom: 0 }}
            type="text"
            value={value}
            onChange={(event) => {
              const next = [...values]
              next[index] = event.target.value
              onChange(next)
            }}
          />
          <button type="button" className="btn-secondary" onClick={() => onChange(values.filter((_, i) => i !== index))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn-link" style={{ marginBottom: '1rem' }} onClick={() => onChange([...values, ''])}>
        Add
      </button>
    </div>
  )
}

export function BriefItemsForm({
  briefId,
  briefStatus,
  initialItems,
  diffEntries,
}: {
  briefId: string
  briefStatus: string
  initialItems: EditableItem[]
  diffEntries: BriefItemDiffEntry[]
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [showDiff, setShowDiff] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()
  const [isConfirming, startConfirm] = useTransition()
  /** Topic keys that are expanded. Default collapsed so long briefs stay scannable. */
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  function topicKey(item: EditableItem, index: number) {
    return item.id ?? `new-${index}`
  }

  function isExpanded(key: string) {
    return expanded.has(key)
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function expandAll() {
    setExpanded(new Set(items.map((item, index) => topicKey(item, index))))
  }

  function collapseAll() {
    setExpanded(new Set())
  }

  function updateItem(index: number, patch: Partial<EditableItem>) {
    const next = [...items]
    next[index] = { ...next[index], ...patch }
    setItems(next)
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    next.forEach((item, i) => {
      item.priorityOrder = i + 1
    })
    setItems(next)
  }

  function addTopic() {
    const index = items.length
    setItems([
      ...items,
      {
        topic: '',
        sectionTitle: '',
        format: '',
        angle: '',
        priorityOrder: items.length + 1,
        region: '',
        keywords: [],
        exclusions: [],
        sentiment: '',
        portrayalNotes: '',
        bannedTerms: [],
        requiredContext: '',
      },
    ])
    setExpanded((prev) => new Set(prev).add(`new-${index}`))
  }

  function removeTopic(index: number) {
    const key = topicKey(items[index], index)
    setItems(items.filter((_, i) => i !== index))
    setExpanded((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  return (
    <div className="card">
      <div className="form-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 0 }}>
        <button type="button" className="btn-secondary" onClick={() => setShowDiff((value) => !value)}>
          {showDiff ? 'Hide original parse' : 'View original parse'}
        </button>
        {!showDiff && items.length > 0 && (
          <>
            <button type="button" className="btn-link" onClick={expandAll}>
              Expand all
            </button>
            <button type="button" className="btn-link" onClick={collapseAll}>
              Collapse all
            </button>
          </>
        )}
      </div>

      {showDiff ? (
        <ul className="list" style={{ marginTop: '1rem' }}>
          {diffEntries.map((entry) => (
            <li key={entry.topic} className={`list-item diff-${entry.status}`}>
              <strong>{entry.topic}</strong> — {entry.status}
              {Object.entries(entry.fieldChanges).map(([field, change]) => (
                <div key={field}>
                  {field}: {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
                </div>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <h2 style={{ marginTop: 0 }}>Step 1 — Approve parse</h2>
          <p className="subtitle">Review topics, then confirm the brief before searching sources.</p>

          {items.map((item, index) => {
            const key = topicKey(item, index)
            const open = isExpanded(key)
            return (
              <div key={key} className={`topic-panel${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="topic-panel-header"
                  aria-expanded={open}
                  onClick={() => toggleExpanded(key)}
                >
                  <span className="topic-panel-chevron" aria-hidden>
                    {open ? '▾' : '▸'}
                  </span>
                  <span className="badge">#{item.priorityOrder || index + 1}</span>
                  {item.sectionTitle && <span className="badge">{item.sectionTitle}</span>}
                  {item.format && <span className="badge">{item.format}</span>}
                  <span className="topic-panel-title">{item.topic || 'Untitled topic'}</span>
                  {item.angle && <span className="topic-panel-meta">{item.angle}</span>}
                </button>

                {open && (
                  <div className="topic-panel-body">
                    <label className="field-label">Topic</label>
                    <input
                      className="field-input"
                      type="text"
                      value={item.topic}
                      onChange={(e) => updateItem(index, { topic: e.target.value })}
                    />

                    <label className="field-label">Section title</label>
                    <input
                      className="field-input"
                      type="text"
                      value={item.sectionTitle}
                      onChange={(e) => updateItem(index, { sectionTitle: e.target.value })}
                      placeholder="e.g. INTERNATIONAL NEWS"
                    />

                    <label className="field-label">Format</label>
                    <input
                      className="field-input"
                      type="text"
                      value={item.format}
                      onChange={(e) => updateItem(index, { format: e.target.value })}
                      placeholder="e.g. News, Video, Op-Ed"
                    />

                    <label className="field-label">Angle</label>
                    <input
                      className="field-input"
                      type="text"
                      value={item.angle}
                      onChange={(e) => updateItem(index, { angle: e.target.value })}
                    />

                    <label className="field-label">Priority order</label>
                    <div className="duplicate-actions" style={{ marginBottom: '1rem' }}>
                      <input
                        className="field-input"
                        style={{ marginBottom: 0, maxWidth: '8rem' }}
                        type="number"
                        value={item.priorityOrder}
                        onChange={(e) => updateItem(index, { priorityOrder: Number(e.target.value) })}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => moveItem(index, -1)}
                        disabled={index === 0}
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => moveItem(index, 1)}
                        disabled={index === items.length - 1}
                      >
                        Move down
                      </button>
                    </div>

                    <label className="field-label">Region</label>
                    <input
                      className="field-input"
                      type="text"
                      value={item.region}
                      onChange={(e) => updateItem(index, { region: e.target.value })}
                    />

                    <label className="field-label">Exclusions</label>
                    <ArrayField values={item.exclusions} onChange={(exclusions) => updateItem(index, { exclusions })} />

                    <label className="field-label">Keywords</label>
                    <ArrayField values={item.keywords} onChange={(keywords) => updateItem(index, { keywords })} />

                    <label className="field-label">Sentiment</label>
                    <input
                      className="field-input"
                      type="text"
                      value={item.sentiment}
                      onChange={(e) => updateItem(index, { sentiment: e.target.value })}
                    />

                    <label className="field-label">Portrayal notes</label>
                    <textarea
                      className="field-input"
                      rows={3}
                      value={item.portrayalNotes}
                      onChange={(e) => updateItem(index, { portrayalNotes: e.target.value })}
                    />

                    <label className="field-label">Banned terms</label>
                    <ArrayField
                      values={item.bannedTerms}
                      onChange={(bannedTerms) => updateItem(index, { bannedTerms })}
                    />

                    <label className="field-label">Required context</label>
                    <textarea
                      className="field-input"
                      rows={3}
                      value={item.requiredContext}
                      onChange={(e) => updateItem(index, { requiredContext: e.target.value })}
                    />

                    <button type="button" className="btn-secondary" onClick={() => removeTopic(index)}>
                      Remove topic
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          <div className="form-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" onClick={addTopic}>
              Add topic
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={isSaving}
              onClick={() =>
                startSave(async () => {
                  setSaveError(null)
                  try {
                    await saveBriefItems(briefId, items)
                  } catch (err) {
                    setSaveError(err instanceof Error ? err.message : 'Could not save.')
                  }
                })
              }
            >
              {isSaving ? 'Saving…' : briefStatus === 'confirmed' ? 'Save as new version' : 'Save'}
            </button>
            {briefStatus !== 'confirmed' && (
              <button
                type="button"
                className="btn-primary"
                disabled={isConfirming}
                onClick={() =>
                  startConfirm(async () => {
                    const result = await confirmBrief(briefId)
                    if (result.error) setConfirmError(result.error)
                    else router.push(`/briefs/${briefId}?tab=workflow&step=2`)
                  })
                }
              >
                {isConfirming ? 'Confirming…' : 'Confirm brief'}
              </button>
            )}
          </div>
          {briefStatus === 'confirmed' && (
            <p className="subtitle" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              Parse confirmed.{' '}
              <a href={`/briefs/${briefId}?tab=workflow&step=2`}>Continue to sources →</a> Saving creates a new
              version that must be re-confirmed.
            </p>
          )}
          {saveError && <div className="banner banner-error">{saveError}</div>}
          {confirmError && <div className="banner banner-error">{confirmError}</div>}
        </>
      )}
    </div>
  )
}
