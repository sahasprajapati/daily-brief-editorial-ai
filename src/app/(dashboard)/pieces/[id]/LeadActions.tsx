'use client'

import { useActionState } from 'react'
import type { AssignmentStatus } from '@/lib/pieces/assignment-status'
import { approvePiece, publishPiece, sendBackPiece } from './actions'

type ActionState = { error: string | null }

const initialState: ActionState = { error: null }

export function LeadActions({
  pieceId,
  status,
  canLead,
  publishedAt,
  cmsPackageId,
}: {
  pieceId: string
  status: AssignmentStatus
  canLead: boolean
  publishedAt?: string | null
  cmsPackageId?: string | null
}) {
  const [approveState, approveAction, approvePending] = useActionState<ActionState, FormData>(
    () => approvePiece(pieceId),
    initialState,
  )
  const [sendBackState, sendBackAction, sendBackPending] = useActionState<ActionState, FormData>(
    () => sendBackPiece(pieceId),
    initialState,
  )
  const [publishState, publishAction, publishPending] = useActionState<ActionState, FormData>(
    () => publishPiece(pieceId),
    initialState,
  )

  if (publishedAt || status === 'published') {
    return (
      <div className="card">
        <h2>Publish</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>
          Published{cmsPackageId ? ` (${cmsPackageId})` : ''}.
        </p>
      </div>
    )
  }

  if (status === 'awaitingApproval') {
    if (!canLead) {
      return (
        <div className="card">
          <h2>Approve</h2>
          <p className="subtitle" style={{ marginTop: 0 }}>
            Waiting for desk lead approval.
          </p>
        </div>
      )
    }

    return (
      <div className="card">
        <h2>Approve</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>
          QA marked this good to go. Approve to unlock publish, or send back for rework.
        </p>
        <div className="form-actions">
          <form action={approveAction}>
            <button type="submit" className="btn-primary" disabled={approvePending}>
              {approvePending ? 'Approving…' : 'Approve'}
            </button>
          </form>
          <form action={sendBackAction}>
            <button type="submit" className="btn-secondary" disabled={sendBackPending}>
              {sendBackPending ? 'Sending back…' : 'Send back'}
            </button>
          </form>
        </div>
        {(approveState.error || sendBackState.error) && (
          <div className="banner banner-error" style={{ marginTop: '0.75rem' }}>
            {approveState.error || sendBackState.error}
          </div>
        )}
      </div>
    )
  }

  if (status === 'approved') {
    if (!canLead) {
      return (
        <div className="card">
          <h2>Publish</h2>
          <p className="subtitle" style={{ marginTop: 0 }}>
            Approved — waiting for a desk lead to publish.
          </p>
        </div>
      )
    }

    return (
      <div className="card">
        <h2>Publish</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>
          Publish this piece to the CMS.
        </p>
        <form action={publishAction} className="form-actions">
          <button type="submit" className="btn-primary" disabled={publishPending}>
            {publishPending ? 'Publishing…' : 'Publish to CMS'}
          </button>
        </form>
        {publishState.error && (
          <div className="banner banner-error" style={{ marginTop: '0.75rem' }}>
            {publishState.error}
          </div>
        )}
      </div>
    )
  }

  return null
}
