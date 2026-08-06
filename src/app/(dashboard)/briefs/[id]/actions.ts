'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { createNextBriefVersion } from '@/lib/briefs/versioning'
import type { ExtractedBriefItem } from '@/lib/brief-extraction'
import { getCmsClient } from '@/lib/cms-client/instance'
import { collectForBriefItem } from '@/lib/collection'
import { generatePieceForTopic } from '@/lib/generation'

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

    const collected = await payload.find({
      collection: 'collected-items',
      where: {
        and: [
          { briefItem: { equals: briefItemId } },
          { reviewStatus: { not_equals: 'rejected' } },
        ],
      },
      limit: 50,
      depth: 1,
      overrideAccess: false,
      user,
    })

    if (collected.docs.length === 0) {
      return { error: 'No sources left for this topic.', pieceId: null }
    }

    const channelConfigResult = await payload.find({
      collection: 'channel-configs',
      where: { channel: { equals: brief.channel } },
      limit: 1,
      overrideAccess: true,
    })
    const channelConfig = channelConfigResult.docs[0] ?? null

    const piece = await generatePieceForTopic(
      payload,
      user,
      briefItem,
      collected.docs,
      brief,
      channelConfig,
    )
    revalidatePath(`/briefs/${briefId}`)
    revalidatePath(`/pieces/${piece.id}`)
    revalidatePath('/')
    return { error: null, pieceId: piece.id }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not generate a draft for this topic.',
      pieceId: null,
    }
  }
}
