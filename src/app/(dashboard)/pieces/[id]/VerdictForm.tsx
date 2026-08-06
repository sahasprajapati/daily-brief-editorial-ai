'use client'

import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import type { QaSuggestion } from '@/lib/qa-suggestions'
import { submitVerdict } from './actions'

type VerdictState = { error: string | null; warning: string | null }

const initialState: VerdictState = { error: null, warning: null }

export function VerdictForm({
  pieceId,
  suggestions,
  onSubmitted,
}: {
  pieceId: string
  suggestions: QaSuggestion[]
  onSubmitted?: () => void
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<VerdictState, FormData>(
    async (_prev, formData) => {
      const verdict = formData.get('verdict') as 'goodToGo' | 'needsAttention' | 'rejected'
      const result = await submitVerdict(pieceId, verdict, suggestions)
      if (result.error) return { error: result.error, warning: null }
      onSubmitted?.()
      router.refresh()
      const warning =
        (verdict === 'needsAttention' || verdict === 'rejected') && suggestions.length === 0
          ? 'Submitted without suggestions — consider adding highlight notes next time.'
          : null
      return { error: null, warning }
    },
    initialState,
  )

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h2>Submit verdict</h2>
      <p className="subtitle">
        Highlight notes in the article are saved with this verdict ({suggestions.length} draft
        suggestion{suggestions.length === 1 ? '' : 's'}).
      </p>
      <form action={formAction}>
        <label htmlFor="verdict">Verdict</label>
        <select id="verdict" name="verdict" required defaultValue="">
          <option value="" disabled>
            Choose one
          </option>
          <option value="goodToGo">Good to go</option>
          <option value="needsAttention">Needs attention</option>
          <option value="rejected">Rejected</option>
        </select>

        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Submitting…' : 'Submit verdict'}
        </button>
        {state.error && (
          <div className="banner banner-error" style={{ marginTop: '0.75rem' }}>
            {state.error}
          </div>
        )}
        {state.warning && (
          <div className="banner banner-warn" style={{ marginTop: '0.75rem' }}>
            {state.warning}
          </div>
        )}
      </form>
    </div>
  )
}
