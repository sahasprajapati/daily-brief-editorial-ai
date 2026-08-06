'use client'

import { useActionState } from 'react'
import { saveNewsHqSettings, type SaveNewsHqSettingsState } from './actions'

const initialState: SaveNewsHqSettingsState = { error: null, saved: false }

export function NewsHqSettingsForm({
  agencies,
  priorities,
  languages,
  selectedAgencies,
  selectedPriorities,
  defaultLang,
  limit,
  baseUrl,
}: {
  agencies: string[]
  priorities: string[]
  languages: string[]
  selectedAgencies: string[]
  selectedPriorities: string[]
  defaultLang: string
  limit: number
  baseUrl: string
}) {
  const [state, formAction, isPending] = useActionState(saveNewsHqSettings, initialState)

  return (
    <form action={formAction} className="nhq-settings-panel">
      <div className="nhq-filter-bar">
        <strong style={{ fontSize: '0.8125rem' }}>Live News HQ</strong>
        <span style={{ flex: 1 }} />
        <code>{baseUrl || 'NEWS_HQ_SEARCH_BASE_URL not set'}</code>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.25rem' }}>
        <legend className="field-label">Agencies</legend>
        <p className="subtitle">Leave all unchecked to use agencies available for the search language.</p>
        <div className="nhq-chip-grid">
          {agencies.map((agency) => (
            <label key={agency} className="nhq-chip">
              <input
                type="checkbox"
                name="agencies"
                value={agency}
                defaultChecked={selectedAgencies.includes(agency)}
              />
              {agency}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.25rem' }}>
        <legend className="field-label">Priorities</legend>
        <div className="nhq-chip-grid">
          {priorities.map((priority) => (
            <label key={priority} className="nhq-chip">
              <input
                type="checkbox"
                name="priorities"
                value={priority}
                defaultChecked={selectedPriorities.includes(priority)}
              />
              P{priority}
            </label>
          ))}
        </div>
      </fieldset>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ flex: '1 1 10rem' }}>
          <label className="field-label" htmlFor="defaultLang">
            Default language
          </label>
          <select
            id="defaultLang"
            name="defaultLang"
            className="field-input"
            defaultValue={defaultLang}
            style={{ marginBottom: 0 }}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '0 0 8rem' }}>
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
            style={{ marginBottom: 0 }}
          />
        </div>
      </div>

      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save settings'}
        </button>
      </div>
      {state.error && <div className="banner banner-error">{state.error}</div>}
      {state.saved && !state.error && <div className="banner banner-success">Settings saved.</div>}
    </form>
  )
}
