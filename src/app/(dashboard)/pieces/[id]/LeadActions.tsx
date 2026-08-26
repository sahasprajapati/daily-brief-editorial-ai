'use client'

import { useActionState } from 'react'
import type { AssignmentStatus } from '@/lib/pieces/assignment-status'
import { approvePiece, publishPiece, sendBackPiece } from './actions'

type ActionState = { error: string | null }
type SendBackState = { error: string | null }

const initialState: ActionState = { error: null }
const initialSendBackState: SendBackState = { error: null }

const VERDICT_LABEL: Record<string, string> = {
  goodToGo: 'Good to go',
  needsAttention: 'Needs attention',
  rejected: 'Rejected',
}

export function LeadActions({
  pieceId,
  status,
  canLead,
  publishedAt,
  cmsPackageId,
  confirmedVerdict,
}: {
  pieceId: string
  status: AssignmentStatus
  canLead: boolean
  publishedAt?: string | null
  cmsPackageId?: string | null
  /** The verdict the editor confirmed via VerdictForm — every verdict routes here for
   *  approval now, not just goodToGo, so the manager needs to see which one it was. */
  confirmedVerdict?: 'goodToGo' | 'needsAttention' | 'rejected' | null
}) {
  const [approveState, approveAction, approvePending] = useActionState<ActionState, FormData>(
    () => approvePiece(pieceId),
    initialState,
  )
  const [sendBackState, sendBackAction, sendBackPending] = useActionState<SendBackState, FormData>(
    async (_prev, formData) => sendBackPiece(pieceId, (formData.get('note') as string) ?? ''),
    initialSendBackState,
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
          {confirmedVerdict ? (
            <>
              Editor confirmed QA verdict:{' '}
              <span className={`verdict-badge verdict-badge-${confirmedVerdict}`}>
                {VERDICT_LABEL[confirmedVerdict]}
              </span>
              . Approve to unlock publish, or send back for rework.
            </>
          ) : (
            'Approve to unlock publish, or send back for rework.'
          )}
        </p>
        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <form action={approveAction}>
            <button type="submit" className="btn-primary" disabled={approvePending}>
              {approvePending ? 'Approving…' : 'Approve'}
            </button>
          </form>
        </div>
        {approveState.error && (
          <div className="banner banner-error" style={{ marginTop: '0.75rem' }}>
            {approveState.error}
          </div>
        )}

        <form action={sendBackAction} style={{ marginTop: '1rem' }}>
          <label htmlFor="note">Send back — reason (required)</label>
          <textarea
            id="note"
            name="note"
            required
            rows={3}
            placeholder="What needs to change before this can be approved?"
          />
          <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
            <button type="submit" className="btn-secondary" disabled={sendBackPending}>
              {sendBackPending ? 'Sending back…' : 'Send back to editor'}
            </button>
          </div>
          {sendBackState.error && (
            <div className="banner banner-error" style={{ marginTop: '0.75rem' }}>
              {sendBackState.error}
            </div>
          )}
        </form>
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
