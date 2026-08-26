'use client'

import { useState } from 'react'

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12a2 2 0 0 1-2 1.9H9.7a2 2 0 0 1-2-1.9L7 7" />
    </svg>
  )
}

/** One line, cut at a word boundary — "a snap of the first phrase", not the whole instruction. */
function snippet(text: string, max = 88): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return oneLine || '(empty)'
  const cut = oneLine.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > 40 ? cut.slice(0, lastSpace) : cut}…`
}

export function InstructionBoxList({
  name,
  initialItems,
  addPlaceholder,
}: {
  /** Form field name — submitted as one hidden input per item, so formData.getAll(name)
   *  on the server collects the whole list. */
  name: string
  initialItems: string[]
  addPlaceholder: string
}) {
  const [items, setItems] = useState(initialItems)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  function addItem(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setItems((prev) => [...prev, trimmed])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
    setExpanded((current) => (current === index ? null : current))
  }

  function updateItem(index: number, text: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? text : item)))
  }

  return (
    <div>
      {items.map((item, index) => (
        <input key={`${name}-${index}`} type="hidden" name={name} value={item} />
      ))}

      {/* Add row comes first, on purpose - a newly added instruction has to land directly
          under where you just typed it, not jump above the input you're looking at. */}
      <div className="instruction-add-row">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addItem(draft)
              setDraft('')
            }
          }}
          placeholder={addPlaceholder}
          className="field-input"
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            addItem(draft)
            setDraft('')
          }}
        >
          Add
        </button>
      </div>

      {items.length === 0 ? (
        <p className="instruction-empty">None set.</p>
      ) : (
        <div className="instruction-list">
          {items.map((item, index) => {
            const isExpanded = expanded === index
            return (
              <div className="instruction-box" key={index}>
                <div className="instruction-box-row">
                  <button
                    type="button"
                    className={`instruction-box-btn${isExpanded ? ' is-active' : ''}`}
                    onClick={() => setExpanded(isExpanded ? null : index)}
                    aria-label={isExpanded ? 'Done editing' : 'Edit'}
                    title={isExpanded ? 'Done editing' : 'Edit'}
                  >
                    <EditIcon />
                  </button>
                  <span className="instruction-box-snippet" onClick={() => setExpanded(isExpanded ? null : index)}>
                    {snippet(item)}
                  </span>
                  <button
                    type="button"
                    className="instruction-box-btn is-delete"
                    onClick={() => removeItem(index)}
                    aria-label="Delete"
                    title="Delete"
                  >
                    <TrashIcon />
                  </button>
                </div>
                {isExpanded && (
                  <div className="instruction-box-edit">
                    <textarea
                      value={item}
                      onChange={(event) => updateItem(index, event.target.value)}
                      rows={3}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
