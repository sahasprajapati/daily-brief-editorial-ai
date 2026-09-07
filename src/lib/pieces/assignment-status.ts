import { checkIsAdmin, isLeadOfDesk } from '@/payload/access/admin'
import type { User } from '@/payload-types'

export type AssignmentStatus =
  | 'claimed'
  | 'inProgress'
  | 'inQA'
  | 'verdictReached'
  | 'drafted'
  // Manager approve/send-back/publish pipeline (LeadActions) - dormant for now, no live piece
  // reaches these via the UI since markPieceAsDrafted stops at 'drafted' instead. Left in place,
  // unused, for when CMS integration brings publishing back into scope.
  | 'awaitingApproval'
  | 'approved'
  | 'published'

/** The editor's 4 steps: write/edit, AI QA, generate a cover image, mark as drafted. There's no
 *  manager hand-off step here anymore - see markPieceAsDrafted (pieces/[id]/actions.ts) - that
 *  comes back once CMS integration/publishing is designed. */
export type PieceStepperStep = 'edit' | 'qa' | 'image' | 'drafted'

/** AI QA decides the verdict (see submitForQaReview): goodToGo surfaces a "Mark as drafted"
 *  step for the editor, but this function itself still resolves to the (dormant) manager-pipeline
 *  status — markPieceAsDrafted sets 'drafted' directly, once the editor explicitly confirms
 *  (they may regenerate the cover image first). needsAttention/rejected go straight back to
 *  editing with the AI's explanation shown, no manager involved. */
export function statusAfterVerdict(
  verdict: 'goodToGo' | 'needsAttention' | 'rejected',
): AssignmentStatus {
  return verdict === 'goodToGo' ? 'awaitingApproval' : 'inProgress'
}

/** Base/fallback step from server-truth status alone — the live page overrides this with
 *  client-side session state (submitting, QA result, image generated, drafted) for anything
 *  that happens without a full status change, same as the QA step already did. */
export function stepFromStatus(status: AssignmentStatus): PieceStepperStep {
  switch (status) {
    case 'inQA':
    case 'verdictReached':
      return 'qa'
    case 'drafted':
    case 'awaitingApproval':
    case 'approved':
    case 'published':
      return 'drafted'
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
