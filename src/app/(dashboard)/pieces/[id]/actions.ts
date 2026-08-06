'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCmsClient } from '@/lib/cms-client/instance'
import type { ContentBlock } from '@/lib/content-diff'
import {
  canLeadActOnPiece,
  statusAfterVerdict,
} from '@/lib/pieces/assignment-status'
import type { QaSuggestion } from '@/lib/qa-suggestions'
import { requireUser } from '@/payload/auth/session'
import type { GeneratedPiece, PieceAssignment, User } from '@/payload-types'

export async function saveBody(pieceId: string, blocks: ContentBlock[]): Promise<{ error: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    await payload.update({
      collection: 'generated-pieces',
      id: pieceId,
      data: { currentBody: blocks },
      overrideAccess: false,
      user,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save this piece.' }
  }

  revalidatePath(`/pieces/${pieceId}`)
  return { error: null }
}

const MANUAL_VERDICT_OKF_VERSION = 'manual'

export async function submitVerdict(
  pieceId: string,
  verdict: 'goodToGo' | 'needsAttention' | 'rejected',
  suggestions: QaSuggestion[] = [],
): Promise<{ error: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    const piece = await payload.findByID({
      collection: 'generated-pieces',
      id: pieceId,
      overrideAccess: false,
      user,
    })
    const currentBody = (piece.currentBody ?? piece.generatedSnapshot ?? []) as ContentBlock[]

    await payload.create({
      collection: 'qa-verdicts',
      data: {
        piece: pieceId,
        pieceBodySnapshot: currentBody,
        verdict,
        okfVersion: MANUAL_VERDICT_OKF_VERSION,
        suggestions: suggestions.map((s) => ({
          quote: s.quote,
          message: s.message,
          severity: s.severity,
          blockId: s.blockId,
          startOffset: s.startOffset,
          endOffset: s.endOffset,
          createdAt: s.createdAt,
        })),
        submittedBy: user.id,
        submittedAt: new Date().toISOString(),
      },
      overrideAccess: false,
      user,
    })

    const assignments = await payload.find({
      collection: 'piece-assignments',
      where: { piece: { equals: pieceId } },
      limit: 1,
      overrideAccess: false,
      user,
    })
    const assignment = assignments.docs[0]
    if (assignment) {
      await payload.update({
        collection: 'piece-assignments',
        id: assignment.id,
        data: { status: statusAfterVerdict(verdict) },
        overrideAccess: false,
        user,
      })
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not submit this verdict.' }
  }

  revalidatePath(`/pieces/${pieceId}`)
  revalidatePath('/')
  return { error: null }
}

type LeadLoadOk = {
  payload: Awaited<ReturnType<typeof getPayload>>
  piece: GeneratedPiece
  assignment: PieceAssignment
}

async function loadPieceAssignmentForLead(
  pieceId: string,
  user: User,
): Promise<LeadLoadOk | { error: string }> {
  const payload = await getPayload({ config: configPromise })
  const piece = await payload.findByID({
    collection: 'generated-pieces',
    id: pieceId,
    overrideAccess: true,
  })
  if (!canLeadActOnPiece(user, piece.channel)) {
    return { error: 'Only a desk lead or admin can do this.' }
  }
  const assignments = await payload.find({
    collection: 'piece-assignments',
    where: { piece: { equals: pieceId } },
    limit: 1,
    overrideAccess: true,
  })
  const assignment = assignments.docs[0]
  if (!assignment) return { error: 'No assignment for this piece.' }
  return { payload, piece, assignment }
}

export async function approvePiece(pieceId: string): Promise<{ error: string | null }> {
  const user = await requireUser()
  const loaded = await loadPieceAssignmentForLead(pieceId, user)
  if ('error' in loaded) return { error: loaded.error }

  const { payload, assignment } = loaded
  if (assignment.status !== 'awaitingApproval') {
    return { error: 'This piece is not awaiting approval.' }
  }

  const verdicts = await payload.find({
    collection: 'qa-verdicts',
    where: { piece: { equals: pieceId } },
    sort: '-submittedAt',
    limit: 1,
    overrideAccess: true,
  })
  if (verdicts.docs[0]?.verdict !== 'goodToGo') {
    return { error: 'Latest verdict must be goodToGo before approval.' }
  }

  try {
    await payload.update({
      collection: 'piece-assignments',
      id: assignment.id,
      data: { status: 'approved' },
      overrideAccess: true,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not approve this piece.' }
  }

  revalidatePath(`/pieces/${pieceId}`)
  revalidatePath('/')
  return { error: null }
}

export async function sendBackPiece(pieceId: string): Promise<{ error: string | null }> {
  const user = await requireUser()
  const loaded = await loadPieceAssignmentForLead(pieceId, user)
  if ('error' in loaded) return { error: loaded.error }

  const { payload, assignment } = loaded
  if (assignment.status !== 'awaitingApproval') {
    return { error: 'This piece is not awaiting approval.' }
  }

  try {
    await payload.update({
      collection: 'piece-assignments',
      id: assignment.id,
      data: { status: 'inProgress' },
      overrideAccess: true,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not send this piece back.' }
  }

  revalidatePath(`/pieces/${pieceId}`)
  revalidatePath('/')
  return { error: null }
}

export async function publishPiece(pieceId: string): Promise<{ error: string | null }> {
  const user = await requireUser()
  const loaded = await loadPieceAssignmentForLead(pieceId, user)
  if ('error' in loaded) return { error: loaded.error }

  const { payload, piece, assignment } = loaded
  if (assignment.status !== 'approved') {
    return { error: 'This piece must be approved before it can be published.' }
  }
  if (piece.publishedAt) {
    return { error: 'This piece is already published.' }
  }

  try {
    const blocks = (piece.currentBody ?? piece.generatedSnapshot ?? []) as ContentBlock[]
    const heading = blocks.find((b) => b.type === 'heading')
    const paragraphs = blocks.filter((b) => b.type === 'paragraph').map((b) => b.text)
    const result = await getCmsClient().createArticle({
      title: heading?.text ?? piece.channelName ?? piece.channel,
      description: '',
      paragraphs,
    })

    await payload.update({
      collection: 'generated-pieces',
      id: pieceId,
      data: {
        publishedAt: new Date().toISOString(),
        cmsPackageId: result.packageId,
      },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'piece-assignments',
      id: assignment.id,
      data: { status: 'published' },
      overrideAccess: true,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not publish this piece.' }
  }

  revalidatePath(`/pieces/${pieceId}`)
  revalidatePath('/')
  return { error: null }
}
