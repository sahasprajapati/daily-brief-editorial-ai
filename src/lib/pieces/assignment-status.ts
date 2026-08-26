import { checkIsAdmin, isLeadOfDesk } from '@/payload/access/admin'
import type { User } from '@/payload-types'

export type AssignmentStatus =
  | 'claimed'
  | 'inProgress'
  | 'inQA'
  | 'verdictReached'
  | 'awaitingApproval'
  | 'approved'
  | 'published'

/** The editor's 4 steps: write/edit, AI QA, generate a cover image, send to the manager.
 *  Approve/publish beyond that are the manager's own steps (shown via LeadActions), not
 *  re-numbered here — once sent, the editor's part of the pipeline is done. */
export type PieceStepperStep = 'edit' | 'qa' | 'image' | 'manager'

/** AI QA decides the verdict (see submitForQaReview): goodToGo surfaces a "Confirm & send to
 *  manager" step for the editor — statusAfterVerdict itself doesn't flip to awaitingApproval,
 *  confirmAndSendToManager does, once the editor explicitly confirms. needsAttention/rejected
 *  go straight back to editing with the AI's explanation shown, no manager involved. */
export function statusAfterVerdict(
  verdict: 'goodToGo' | 'needsAttention' | 'rejected',
): AssignmentStatus {
  return verdict === 'goodToGo' ? 'awaitingApproval' : 'inProgress'
}

/** Base/fallback step from server-truth status alone — the live page overrides this with
 *  client-side session state (submitting, QA result, image generated, confirmed) for anything
 *  that happens without a full status change, same as the QA step already did. */
export function stepFromStatus(status: AssignmentStatus): PieceStepperStep {
  switch (status) {
    case 'inQA':
    case 'verdictReached':
      return 'qa'
    case 'awaitingApproval':
    case 'approved':
    case 'published':
      return 'manager'
    default:
      return 'edit'
  }
}

export function canLeadActOnPiece(
  user: Pick<User, 'role' | 'leadOfDesks'> | null,
  channel: string,
): boolean {
  if (!user) return false
  if (checkIsAdmin(user as User)) return true
  return isLeadOfDesk(user as User, channel)
}
