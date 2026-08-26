import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import type { ContentBlock } from '@/lib/content-diff'
import { type AssignmentStatus, canLeadActOnPiece } from '@/lib/pieces/assignment-status'
import { LeadActions } from './LeadActions'
import { PieceWorkspace } from './PieceWorkspace'

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  let piece
  try {
    piece = await payload.findByID({
      collection: 'generated-pieces',
      id,
      overrideAccess: false,
      user,
    })
  } catch {
    notFound()
  }

  if (!piece) notFound()

  const canLead = canLeadActOnPiece(user, piece.channel)

  const assignments = await payload.find({
    collection: 'piece-assignments',
    where: { piece: { equals: id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const assignment = assignments.docs[0]
  const assigneeId =
    assignment && typeof assignment.assignedTo === 'object'
      ? assignment.assignedTo.id
      : assignment?.assignedTo
  const isAssignee = assigneeId === user.id

  if (!isAssignee && !canLead) {
    notFound()
  }

  const status = (assignment?.status ?? 'claimed') as AssignmentStatus

  const generatedSnapshot = (piece.generatedSnapshot ?? []) as ContentBlock[]
  const currentBody = (piece.currentBody ?? generatedSnapshot) as ContentBlock[]

  const latestVerdicts = await payload.find({
    collection: 'qa-verdicts',
    where: { piece: { equals: id } },
    sort: '-submittedAt',
    limit: 1,
    // Page already gated to assignee or lead/admin.
    overrideAccess: true,
  })
  const latest = latestVerdicts.docs[0]

  return (
    <div className="page page-wide">
      <h1>{piece.channelName ?? piece.channel}</h1>
      <p className="subtitle">{piece.attributionString}</p>
      {latest && (
        <p className="subtitle">
          Latest verdict: <span className="badge">{latest.verdict}</span>
          {' · '}
          Status: <span className="badge">{status}</span>
        </p>
      )}

      {assignment?.managerNote && (
        <div className="banner banner-warn" style={{ marginBottom: '1rem' }}>
          <strong>Sent back by manager:</strong> {assignment.managerNote}
        </div>
      )}

      <LeadActions
        pieceId={piece.id}
        status={status}
        canLead={canLead}
        publishedAt={piece.publishedAt}
        cmsPackageId={piece.cmsPackageId}
        confirmedVerdict={latest?.verdict}
      />

      <PieceWorkspace
        pieceId={piece.id}
        initialBlocks={currentBody}
        initialStatus={status}
        latestVerdict={latest?.verdict ?? null}
        initialCoverImageUrl={piece.coverImageDataUrl ?? null}
        initialCoverImagePrompt={piece.coverImagePrompt ?? null}
      />
    </div>
  )
}
