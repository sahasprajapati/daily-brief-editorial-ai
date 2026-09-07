'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCmsClient } from '@/lib/cms-client/instance'
import type { ContentBlock } from '@/lib/content-diff'
import { generateCoverImage } from '@/lib/cover-image'
import { joinChannelInstructions } from '@/lib/channel-instructions'
import {
  canLeadActOnPiece,
  statusAfterVerdict,
} from '@/lib/pieces/assignment-status'
import type { QaSuggestion } from '@/lib/qa-suggestions'
import { runQaVerdictCheck, type QaVerdictResult } from '@/lib/qa-verdict'
import { requireUser } from '@/payload/auth/session'
import type { GeneratedPiece, PieceAssignment, User } from '@/payload-types'

const AI_VERDICT_OKF_VERSION = 'ai'

/** Saves the edit, then runs the AI QA verdict against it — this is the single "Submit" action
 *  on the review page. goodToGo does NOT flip the assignment to 'drafted' by itself; the editor
 *  still has to explicitly confirm (see markPieceAsDrafted) after seeing the AI's reasoning.
 *  needsAttention/rejected send the piece straight back to editing. */
export async function submitForQaReview(
  pieceId: string,
  blocks: ContentBlock[],
): Promise<{ error: string | null; result: QaVerdictResult | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    const piece = await payload.update({
      collection: 'generated-pieces',
      id: pieceId,
      data: { currentBody: blocks },
      overrideAccess: false,
      user,
    })

    const collectedItem =
      typeof piece.collectedItem === 'object'
        ? piece.collectedItem
        : await payload.findByID({
            collection: 'collected-items',
            id: piece.collectedItem,
            depth: 1,
            overrideAccess: true,
          })
    const briefItem =
      typeof collectedItem.briefItem === 'object'
        ? collectedItem.briefItem
        : await payload.findByID({
            collection: 'brief-items',
            id: collectedItem.briefItem,
            overrideAccess: true,
          })

    const channelConfigResult = await payload.find({
      collection: 'channel-configs',
      where: { channel: { equals: piece.channel } },
      limit: 1,
      overrideAccess: true,
    })

    const result = await runQaVerdictCheck({
      blocks,
      bannedTerms: briefItem.bannedTerms ?? [],
      angle: briefItem.angle ?? '',
      sentiment: briefItem.sentiment ?? '',
      portrayalNotes: briefItem.portrayalNotes ?? '',
      requiredContext: briefItem.requiredContext ?? '',
      guidelineSlug: channelConfigResult.docs[0]?.guidelineSlug,
      extraQaInstructions: joinChannelInstructions(
        channelConfigResult.docs[0]?.majorQaFileText,
        channelConfigResult.docs[0]?.extraQaInstructions,
      ),
    })

    await payload.create({
      collection: 'qa-verdicts',
      data: {
        piece: pieceId,
        pieceBodySnapshot: blocks,
        verdict: result.verdict,
        okfVersion: AI_VERDICT_OKF_VERSION,
        submittedBy: user.id,
        submittedAt: new Date().toISOString(),
      },
      overrideAccess: false,
      user,
    })

    // goodToGo waits for the editor's explicit confirm — see markPieceAsDrafted.
    if (result.verdict !== 'goodToGo') {
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
          data: { status: statusAfterVerdict(result.verdict) },
          overrideAccess: false,
          user,
        })
      }
    }

    revalidatePath(`/pieces/${pieceId}`)
    revalidatePath('/')
    return { error: null, result }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not run QA on this piece.', result: null }
  }
}

/** Step 3 — generates (or regenerates) the cover image and persists it on the piece. Doesn't
 *  touch assignment status; the editor can regenerate as many times as they like before moving
 *  on to step 4. Shape and any "avoid depicting X" style rules are channel-general settings
 *  (channel-configs.defaultCoverImageRatio / extraImageInstructions, edited on the Instructions
 *  settings page) — not something the editor picks per article, same pattern as the QA/writing
 *  instructions above. */
export async function generateCoverImageForPiece(
  pieceId: string,
  prompt: string,
): Promise<{ error: string | null; dataUrl: string | null; prompt: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) {
    return { error: 'A prompt is required to generate a cover image.', dataUrl: null, prompt: null }
  }

  try {
    const piece = await payload.findByID({
      collection: 'generated-pieces',
      id: pieceId,
      overrideAccess: false,
      user,
    })
    const channelConfigResult = await payload.find({
      collection: 'channel-configs',
      where: { channel: { equals: piece.channel } },
      limit: 1,
      overrideAccess: true,
    })
    const channelConfig = channelConfigResult.docs[0]

    const image = await generateCoverImage(
      trimmedPrompt,
      channelConfig?.defaultCoverImageRatio ?? undefined,
      (channelConfig?.extraImageInstructions ?? []).join('. '),
    )

    // Persist (and hand back to the client) the composed prompt generateCoverImage actually
    // sent — including the base style directive — not the raw trimmedPrompt the editor typed.
    // Otherwise the directive is applied but never visible in the saved/displayed prompt.
    await payload.update({
      collection: 'generated-pieces',
      id: pieceId,
      data: {
        coverImageDataUrl: image.dataUrl,
        coverImagePrompt: image.prompt,
        coverImageGeneratedAt: new Date().toISOString(),
      },
      overrideAccess: false,
      user,
    })

    revalidatePath(`/pieces/${pieceId}`)
    return { error: null, dataUrl: image.dataUrl, prompt: image.prompt }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not generate a cover image.',
      dataUrl: null,
      prompt: null,
    }
  }
}

/** The editor's explicit hand-off after seeing a goodToGo AI verdict and generating a cover
 *  image — moves the piece to 'drafted', its terminal state for now. No manager review/publish
 *  step yet; that comes back once CMS integration is in place (see LeadActions, still there but
 *  unreachable via this status). A plain status update, not statusAfterVerdict — that helper's
 *  goodToGo branch resolves to the dormant manager-pipeline status, not this one. */
export async function markPieceAsDrafted(pieceId: string): Promise<{ error: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    const assignments = await payload.find({
      collection: 'piece-assignments',
      where: { piece: { equals: pieceId } },
      limit: 1,
      overrideAccess: false,
      user,
    })
    const assignment = assignments.docs[0]

    const verdicts = await payload.find({
      collection: 'qa-verdicts',
      where: { piece: { equals: pieceId } },
      sort: '-submittedAt',
      limit: 1,
      overrideAccess: true,
    })
    if (verdicts.docs[0]?.verdict !== 'goodToGo') {
      return { error: 'Latest QA verdict must be goodToGo before this can be marked as drafted.' }
    }

    if (assignment) {
      await payload.update({
        collection: 'piece-assignments',
        id: assignment.id,
        data: { status: 'drafted' },
        overrideAccess: false,
        user,
      })
    } else {
      // No assignment doc yet - reachable via the read-only brief/output views (ArticleGrid
      // links straight into /pieces/[id], no claim step), which only a lead/admin can open
      // without one (see page.tsx's isAssignee || canLead gate). Self-claim it as drafted
      // rather than erroring, same as ClaimButton's self-claim elsewhere.
      await payload.create({
        collection: 'piece-assignments',
        data: { piece: pieceId, assignedTo: user.id, status: 'drafted', claimedAt: new Date().toISOString() },
        overrideAccess: false,
        user,
      })
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not mark this piece as drafted.' }
  }

  revalidatePath(`/pieces/${pieceId}`)
  revalidatePath('/')
  return { error: null }
}

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

/** The manager's own sign-off — independent of what verdict QA/the editor confirmed (every
 *  verdict routes here, see statusAfterVerdict). Approving accepts whatever the editor
 *  submitted; it does not require goodToGo. */
export async function approvePiece(pieceId: string): Promise<{ error: string | null }> {
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
      data: { status: 'approved', managerNote: null, managerNoteBy: null, managerNoteAt: null },
      overrideAccess: true,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not approve this piece.' }
  }

  revalidatePath(`/pieces/${pieceId}`)
  revalidatePath('/')
  return { error: null }
}

/** Rejecting sends the piece back to the editor — a note explaining why is required so they
 *  know what to fix, not just that it bounced. */
export async function sendBackPiece(pieceId: string, note: string): Promise<{ error: string | null }> {
  const user = await requireUser()
  const trimmedNote = note.trim()
  if (!trimmedNote) {
    return { error: 'A note explaining why is required when sending a piece back.' }
  }

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
      data: {
        status: 'inProgress',
        managerNote: trimmedNote,
        managerNoteBy: user.id,
        managerNoteAt: new Date().toISOString(),
      },
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
