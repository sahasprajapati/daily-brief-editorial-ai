'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getPayload, type Payload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { createNextBriefVersion } from '@/lib/briefs/versioning'
import type { ExtractedBriefItem } from '@/lib/brief-extraction'
import { getCmsClient } from '@/lib/cms-client/instance'
import { collectForBriefItem } from '@/lib/collection'
import { generatePieceForTopic } from '@/lib/generation'
import { briefItemIdOfPiece } from '@/lib/briefs/pieces'
import type { BriefItem, ChannelConfig, EditorialBrief, User } from '@/payload-types'

export type SaveBriefState = { error: string | null }

/** A confirmed brief's items are never edited in place - editing runs the same supersede/
 *  new-version mechanics as the duplicate-upload "replace" choice, and redirects to the new
 *  version so the lead re-confirms it (spec: "Re-edit after confirm"). An unconfirmed ('parsed')
 *  brief's items are just updated directly. */
export async function saveBriefItems(briefId: string, items: (ExtractedBriefItem & { id?: string })[]) {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  const brief = await payload.findByID({ collection: 'editorial-briefs', id: briefId, overrideAccess: false, user })

  if (brief.status === 'confirmed') {
    const currentItems = await payload.find({
      collection: 'brief-items',
      where: { brief: { equals: briefId } },
      limit: 100,
      overrideAccess: false,
      user,
    })
    const nextVersion = await createNextBriefVersion({
      payload,
      user,
      previous: brief,
      items,
      rawParseSnapshot: currentItems.docs,
      sourceType: brief.sourceType,
      sourceFile: typeof brief.sourceFile === 'string' ? brief.sourceFile : brief.sourceFile?.id,
      rawText: brief.rawText,
      title: brief.title,
    })
    redirect(`/briefs/${nextVersion.id}`)
  }

  const existingItems = await payload.find({
    collection: 'brief-items',
    where: { brief: { equals: briefId } },
    limit: 100,
    overrideAccess: false,
    user,
  })
  const existingIds = new Set(existingItems.docs.map((doc) => doc.id))
  const incomingIds = new Set(items.map((item) => item.id).filter(Boolean))

  for (const item of items) {
    const { id, ...data } = item
    if (id && existingIds.has(id)) {
      await payload.update({ collection: 'brief-items', id, data, overrideAccess: false, user })
    } else {
      await payload.create({
        collection: 'brief-items',
        data: { brief: briefId, status: 'pending', ...data },
        overrideAccess: false,
        user,
      })
    }
  }

  for (const existingId of existingIds) {
    if (!incomingIds.has(existingId)) {
      await payload.delete({ collection: 'brief-items', id: existingId, overrideAccess: false, user })
    }
  }

  revalidatePath(`/briefs/${briefId}`)
}

export async function confirmBrief(briefId: string): Promise<{ error: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    await payload.update({
      collection: 'editorial-briefs',
      id: briefId,
      data: { status: 'confirmed', confirmedBy: user.id, confirmedAt: new Date().toISOString() },
      overrideAccess: false,
      user,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not confirm this brief.' }
  }

  revalidatePath(`/briefs/${briefId}`)
  revalidatePath('/briefs')
  return { error: null }
}

export type StartCollectionState = { error: string | null; summary: string | null }

export async function startCollection(briefId: string): Promise<StartCollectionState> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  const brief = await payload.findByID({ collection: 'editorial-briefs', id: briefId, overrideAccess: false, user })
  if (brief.status !== 'confirmed') {
    return { error: 'Confirm this brief before starting collection.', summary: null }
  }

  const pendingItems = await payload.find({
    collection: 'brief-items',
    where: { brief: { equals: briefId } },
    limit: 100,
    overrideAccess: false,
    user,
  })

  const cmsClient = getCmsClient()
  let collectedCount = 0
  let queriedTopics = 0
  let errorTopics = 0
  const topicErrors: string[] = []

  try {
    for (const briefItem of pendingItems.docs) {
      const { collectedItems, status, error } = await collectForBriefItem(
        payload,
        user,
        cmsClient,
        briefItem,
        brief,
      )
      collectedCount += collectedItems.length
      if (status === 'error') {
        errorTopics += 1
        if (error && topicErrors.length < 3) {
          topicErrors.push(`${briefItem.topic}: ${error}`)
        }
      } else {
        queriedTopics += 1
      }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Collection failed partway through.', summary: null }
  }

  revalidatePath('/')
  revalidatePath(`/briefs/${briefId}`)

  if (errorTopics > 0 && collectedCount === 0) {
    return {
      error: topicErrors[0] ?? `NewsHQ search failed for ${errorTopics} topic(s).`,
      summary: null,
    }
  }

  return {
    error: null,
    summary: `${collectedCount} NewsHQ hit(s) for ${queriedTopics} topic(s)${errorTopics ? `; ${errorTopics} topic(s) failed` : ''}. Expand a topic to reject any wires that do not belong.`,
  }
}

export async function setSourceReviewStatus(
  collectedItemId: string,
  briefId: string,
  reviewStatus: 'selected' | 'rejected' | 'candidate',
): Promise<{ error: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    if (reviewStatus === 'rejected') {
      // Remove non-relevant sources from the brief instead of leaving them visible.
      await payload.delete({
        collection: 'collected-items',
        id: collectedItemId,
        overrideAccess: false,
        user,
      })
    } else {
      await payload.update({
        collection: 'collected-items',
        id: collectedItemId,
        data: { reviewStatus },
        overrideAccess: false,
        user,
      })
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not update this source.' }
  }

  revalidatePath(`/briefs/${briefId}`)
  revalidatePath('/briefs')
  return { error: null }
}

async function loadChannelConfig(payload: Payload, channel: string): Promise<ChannelConfig | null> {
  const result = await payload.find({
    collection: 'channel-configs',
    where: { channel: { equals: channel } },
    limit: 1,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

/** Shared by generateForBriefItem and generateAllForBrief so the two can't drift: loads a
 *  topic's remaining (non-rejected) sources and runs generation against them. */
async function generateOneTopic(
  payload: Payload,
  user: User,
  briefItem: BriefItem,
  brief: EditorialBrief,
  channelConfig: ChannelConfig | null,
): Promise<{ pieceId: string } | { error: string }> {
  const collected = await payload.find({
    collection: 'collected-items',
    where: {
      and: [
        { briefItem: { equals: briefItem.id } },
        { reviewStatus: { not_equals: 'rejected' } },
      ],
    },
    limit: 50,
    depth: 1,
    overrideAccess: false,
    user,
  })

  if (collected.docs.length === 0) {
    return { error: 'No sources left for this topic.' }
  }

  try {
    const piece = await generatePieceForTopic(payload, user, briefItem, collected.docs, brief, channelConfig)
    return { pieceId: piece.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not generate a draft for this topic.' }
  }
}

/** Generate one article for a brief topic from all of its remaining (non-rejected) sources. */
export async function generateForBriefItem(
  briefItemId: string,
  briefId: string,
): Promise<{ error: string | null; pieceId: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    const briefItem = await payload.findByID({
      collection: 'brief-items',
      id: briefItemId,
      overrideAccess: false,
      user,
    })
    const brief = await payload.findByID({
      collection: 'editorial-briefs',
      id: briefId,
      overrideAccess: false,
      user,
    })
    const channelConfig = await loadChannelConfig(payload, brief.channel)

    const result = await generateOneTopic(payload, user, briefItem, brief, channelConfig)
    revalidatePath(`/briefs/${briefId}`)
    revalidatePath('/')
    if ('error' in result) return { error: result.error, pieceId: null }
    revalidatePath(`/pieces/${result.pieceId}`)
    return { error: null, pieceId: result.pieceId }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not generate a draft for this topic.',
      pieceId: null,
    }
  }
}

export type GenerateAllState = {
  error: string | null
  generatedCount: number
  skippedCount: number
  failures: Array<{ topic: string; error: string }>
}

/** Generates a draft for every brief topic that has surviving sources and doesn't already have
 *  an article — so an editor doesn't have to click "Generate article" once per topic. Runs
 *  sequentially inside one request, same synchronous precedent as "Start collection". Topics
 *  that already have a piece are left alone (use the per-topic "Regenerate" button for those,
 *  so this can't silently clobber an article already in review). */
export async function generateAllForBrief(briefId: string): Promise<GenerateAllState> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    const brief = await payload.findByID({
      collection: 'editorial-briefs',
      id: briefId,
      overrideAccess: false,
      user,
    })
    const channelConfig = await loadChannelConfig(payload, brief.channel)

    const briefItems = await payload.find({
      collection: 'brief-items',
      where: { brief: { equals: briefId } },
      sort: 'priorityOrder',
      limit: 100,
      overrideAccess: false,
      user,
    })

    const existingPieces = await payload.find({
      collection: 'generated-pieces',
      where: { brief: { equals: briefId } },
      limit: 200,
      depth: 1,
      overrideAccess: true,
    })
    const briefItemIdsWithPiece = new Set(
      existingPieces.docs.map((piece) => briefItemIdOfPiece(piece)).filter((id): id is string => Boolean(id)),
    )

    let generatedCount = 0
    let skippedCount = 0
    const failures: Array<{ topic: string; error: string }> = []

    for (const briefItem of briefItems.docs) {
      if (briefItemIdsWithPiece.has(briefItem.id)) {
        skippedCount += 1
        continue
      }
      const result = await generateOneTopic(payload, user, briefItem, brief, channelConfig)
      if ('error' in result) {
        // "No sources left" just means this topic has nothing to generate from yet - not a
        // failure worth alarming the editor over, same as it not showing a Generate button.
        if (result.error === 'No sources left for this topic.') {
          skippedCount += 1
        } else {
          failures.push({ topic: briefItem.topic, error: result.error })
        }
      } else {
        generatedCount += 1
      }
    }

    revalidatePath(`/briefs/${briefId}`)
    revalidatePath('/')
    return { error: null, generatedCount, skippedCount, failures }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not generate articles for this brief.',
      generatedCount: 0,
      skippedCount: 0,
      failures: [],
    }
  }
}
