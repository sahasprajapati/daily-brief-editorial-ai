'use client'

import { useActionState } from 'react'
import { claimPiece } from './actions'

type ClaimState = { error: string | null }

const initialState: ClaimState = { error: null }

export function ClaimButton({ pieceId }: { pieceId: string }) {
  const [state, formAction, isPending] = useActionState<ClaimState, FormData>(
    () => claimPiece(pieceId),
    initialState,
  )

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending}>
        {isPending ? 'Claiming…' : 'Claim'}
      </button>
      {state.error && <p className="error">{state.error}</p>}
    </form>
  )
}
