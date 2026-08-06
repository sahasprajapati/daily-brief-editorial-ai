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

export type PieceStepperStep = 'edit' | 'qa' | 'approve' | 'publish'

export function statusAfterVerdict(
  verdict: 'goodToGo' | 'needsAttention' | 'rejected',
): AssignmentStatus {
  return verdict === 'goodToGo' ? 'awaitingApproval' : 'inProgress'
}

export function stepFromStatus(status: AssignmentStatus): PieceStepperStep {
  switch (status) {
    case 'inQA':
    case 'verdictReached':
      return 'qa'
    case 'awaitingApproval':
      return 'approve'
    case 'approved':
    case 'published':
      return 'publish'
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
