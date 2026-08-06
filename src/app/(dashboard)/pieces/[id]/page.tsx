import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { diffBlockSnapshots, type ContentBlock } from '@/lib/content-diff'
import {
  type AssignmentStatus,
  canLeadActOnPiece,
  stepFromStatus,
} from '@/lib/pieces/assignment-status'
import { runPreQaChecks } from '@/lib/pre-qa'
import type { QaSuggestion } from '@/lib/qa-suggestions'
import { LeadActions } from './LeadActions'
import { PieceStepper } from './PieceStepper'
import { PreQaHints } from './PreQaHints'
import { PieceWorkspace } from './PieceWorkspace'

function mapPersistedSuggestions(
  raw: NonNullable<import('@/payload-types').QaVerdict['suggestions']>,
): QaSuggestion[] {
  return raw.map((row, index) => ({
    id: row.id ?? `persisted-${index}`,
    quote: row.quote,
    message: row.message,
    severity: row.severity,
    blockId: row.blockId,
    startOffset: row.startOffset,
    endOffset: row.endOffset,
    createdAt: row.createdAt,
  }))
}

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
  const currentStep = stepFromStatus(status)

  const generatedSnapshot = (piece.generatedSnapshot ?? []) as ContentBlock[]
  const currentBody = (piece.currentBody ?? generatedSnapshot) as ContentBlock[]
  const diffEntries = diffBlockSnapshots(generatedSnapshot, currentBody)

  const collectedItem =
    typeof piece.collectedItem === 'object'
      ? piece.collectedItem
      : await payload.findByID({
          collection: 'collected-items',
          id: piece.collectedItem,
          depth: 1,
          overrideAccess: true,
        })
  const briefItemForPiece =
    typeof collectedItem.briefItem === 'object'
      ? collectedItem.briefItem
      : await payload.findByID({
          collection: 'brief-items',
          id: collectedItem.briefItem,
          overrideAccess: true,
        })

  const preQaResult = await runPreQaChecks(currentBody, briefItemForPiece.bannedTerms ?? [])

  const latestVerdicts = await payload.find({
    collection: 'qa-verdicts',
    where: { piece: { equals: id } },
    sort: '-submittedAt',
    limit: 1,
    // Page already gated to assignee or lead/admin.
    overrideAccess: true,
  })
  const latest = latestVerdicts.docs[0]
  const persistedSuggestions =
    latest?.suggestions && latest.suggestions.length > 0
      ? mapPersistedSuggestions(latest.suggestions)
      : []

  return (
    <div className="page page-wide">
      <h1>{piece.channelName ?? piece.channel}</h1>
      <p className="subtitle">{piece.attributionString}</p>
      <PieceStepper current={currentStep} />
      {latest && (
        <p className="subtitle">
          Latest verdict: <span className="badge">{latest.verdict}</span>
          {persistedSuggestions.length > 0 && <> — {persistedSuggestions.length} suggestion(s)</>}
          {' · '}
          Status: <span className="badge">{status}</span>
        </p>
      )}

      <LeadActions
        pieceId={piece.id}
        status={status}
        canLead={canLead}
        publishedAt={piece.publishedAt}
        cmsPackageId={piece.cmsPackageId}
      />

      <PreQaHints result={preQaResult} />
      <PieceWorkspace
        pieceId={piece.id}
        initialBlocks={currentBody}
        diffEntries={diffEntries}
        persistedSuggestions={persistedSuggestions}
      />
    </div>
  )
}
