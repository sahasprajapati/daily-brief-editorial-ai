import type { Payload } from 'payload'
import type { BriefItem, ChannelConfig, CollectedItem, EditorialBrief, GeneratedPiece, User } from '@/payload-types'
import type { ContentBlock } from '@/lib/content-diff'
import { getGuidelineText } from '@/lib/okf-ruleset'
import { runGeneration } from './gemini'

/** Generate one article for a brief topic using all of that topic's collected sources. */
export async function generatePieceForTopic(
  payload: Payload,
  user: User,
  briefItem: BriefItem,
  collectedItems: CollectedItem[],
  brief: EditorialBrief,
  channelConfig: ChannelConfig | null,
): Promise<GeneratedPiece> {
  if (collectedItems.length === 0) {
    throw new Error('No sources available for this topic.')
  }

  const guidelineText = await getGuidelineText(channelConfig?.guidelineSlug)
  const primary = collectedItems[0]

  const result = await runGeneration({
    topic: briefItem.topic,
    language: channelConfig?.language ?? 'English',
    angle: briefItem.angle ?? '',
    sentiment: briefItem.sentiment ?? '',
    portrayalNotes: briefItem.portrayalNotes ?? '',
    requiredContext: briefItem.requiredContext ?? '',
    bannedTerms: briefItem.bannedTerms ?? [],
    guidelineText,
    sources: collectedItems.map((item) => ({
      headline: item.headline,
      body: item.body,
      agency:
        typeof item.sources[0]?.provider === 'object'
          ? item.sources[0].provider.name
          : item.sources[0]?.provider,
    })),
  })

  const blocks: ContentBlock[] = result.blocks.map((block) => ({
    blockId: crypto.randomUUID(),
    type: block.type,
    text: block.text,
  }))

  const agencyNames = [
    ...new Set(
      collectedItems.flatMap((item) =>
        item.sources.map((source) =>
          typeof source.provider === 'object' ? source.provider.name : source.provider,
        ),
      ),
    ),
  ]
  const attributionString = `Sources: ${agencyNames.join(', ')} (${collectedItems.length} wire item(s))`

  // Schema still requires one collectedItem FK — use the primary/first source as the anchor.
  return payload.create({
    collection: 'generated-pieces',
    data: {
      collectedItem: primary.id,
      brief: brief.id,
      channel: brief.channel,
      channelName: brief.channelName,
      generatedSnapshot: blocks,
      currentBody: blocks,
      attributionString,
      sourceOnly: false,
    },
    overrideAccess: false,
    user,
  })
}

/** @deprecated Prefer generatePieceForTopic — kept name for older tests/callers via alias. */
export async function generatePiece(
  payload: Payload,
  user: User,
  collectedItem: CollectedItem,
  briefItem: BriefItem,
  brief: EditorialBrief,
  channelConfig: ChannelConfig | null,
): Promise<GeneratedPiece> {
  return generatePieceForTopic(payload, user, briefItem, [collectedItem], brief, channelConfig)
}
