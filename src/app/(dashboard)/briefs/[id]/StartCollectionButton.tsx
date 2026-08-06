'use client'

import { useActionState } from 'react'
import { startCollection, type StartCollectionState } from './actions'

const initialState: StartCollectionState = { error: null, summary: null }

export function StartCollectionButton({ briefId }: { briefId: string }) {
  const [state, formAction, isPending] = useActionState<StartCollectionState, FormData>(
    () => startCollection(briefId),
    initialState,
  )

  return (
    <form action={formAction}>
      <button type="submit" className="btn-primary" disabled={isPending}>
        {isPending ? 'Searching NewsHQ…' : 'Search NewsHQ'}
      </button>
      {state.error && <div className="banner banner-error">{state.error}</div>}
      {state.summary && <p className="subtitle" style={{ marginTop: '0.75rem', marginBottom: 0 }}>{state.summary}</p>}
    </form>
  )
}
