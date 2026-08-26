'use client'

import { useActionState } from 'react'
import { saveNewsHqSettings, saveNewsHqWirePriorities, type SaveNewsHqSettingsState } from './actions'

const initialState: SaveNewsHqSettingsState = { error: null, saved: false }

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L19 7" />
    </svg>
  )
}

export function NewsHqSettingsForm({
  agencies,
  priorities,
  languages,
  wirePriorities,
  language,
  limit,
}: {
  agencies: string[]
  priorities: string[]
  languages: string[]
  wirePriorities: Array<{ agency: string; priority: string }>
  language: string
  limit: number
}) {
  const [wireState, wireAction, wireIsPending] = useActionState(saveNewsHqWirePriorities, initialState)
  const [allState, allAction, allIsPending] = useActionState(saveNewsHqSettings, initialState)

  const selectedByAgency = new Map(wirePriorities.map((wire) => [wire.agency, wire.priority]))

  return (
    <form className="nhq-settings-panel">
      <div className="nhq-settings-section">
        <p className="nhq-settings-section-title">Wire priorities</p>
        <p className="nhq-settings-hint">
          Pick a priority for the wires you want to search - a wire left on “None” isn&apos;t searched. Leave every
          wire on “None” to search all agencies at every priority.
        </p>
        <div className="nhq-wire-list">
          {agencies.map((agency) => {
            const selected = selectedByAgency.get(agency) ?? ''
            return (
              <div className="nhq-wire-row" key={agency}>
                <input type="hidden" name="wireAgency" value={agency} />
                <span className="nhq-wire-name">{agency}</span>
                <div className="nhq-chip-grid nhq-wire-priorities">
                  <label className="nhq-chip nhq-chip-sm">
                    <input type="radio" name={`wirePriority__${agency}`} value="" defaultChecked={selected === ''} />
                    <span className="nhq-chip-check">
                      <CheckIcon />
                    </span>
                    None
                  </label>
                  {priorities.map((priority) => (
                    <label className="nhq-chip nhq-chip-sm" key={priority}>
                      <input
                        type="radio"
                        name={`wirePriority__${agency}`}
                        value={priority}
                        defaultChecked={selected === priority}
                      />
                      <span className="nhq-chip-check">
                        <CheckIcon />
                      </span>
                      P{priority}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="submit" formAction={wireAction} className="btn-secondary" disabled={wireIsPending}>
            {wireIsPending ? 'Saving…' : 'Save wire priorities'}
          </button>
        </div>
        {wireState.error && <div className="banner banner-error">{wireState.error}</div>}
        {wireState.saved && !wireState.error && <div className="banner banner-success">Wire priorities saved.</div>}
      </div>

      <hr className="settings-divider" />

      <div className="nhq-settings-section">
        <p className="nhq-settings-section-title">Language &amp; results</p>
        <p className="nhq-settings-hint">Fallback language is used only when a channel has no language mapping of its own.</p>
        <div className="nhq-settings-row">
          <div className="nhq-field-card" style={{ flex: '0 0 13rem' }}>
            <label className="field-label" htmlFor="language">
              Fallback language
            </label>
            <select id="language" name="language" className="field-input nhq-select" defaultValue={language}>
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
          <div className="nhq-field-card" style={{ flex: '0 0 10rem' }}>
            <label className="field-label" htmlFor="limit">
              Results per topic
            </label>
            <input
              id="limit"
              name="limit"
              className="field-input"
              type="number"
              min={1}
              max={100}
              defaultValue={limit}
            />
          </div>
        </div>
      </div>

      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="submit" formAction={allAction} className="btn-primary" disabled={allIsPending}>
          {allIsPending ? 'Saving…' : 'Save all settings'}
        </button>
      </div>
      {allState.error && <div className="banner banner-error">{allState.error}</div>}
      {allState.saved && !allState.error && <div className="banner banner-success">Settings saved.</div>}
    </form>
  )
}
