import type { ContentBlock } from '@/lib/content-diff'
import type { CollectedItem, GeneratedPiece } from '@/payload-types'

/** Prefer the generated heading block; fall back to wire headline. */
export function pieceHeadline(piece: GeneratedPiece): string {
  const blocks = (piece.currentBody ?? piece.generatedSnapshot ?? []) as ContentBlock[]
  const heading = blocks.find((block) => block.type === 'heading')
  if (heading?.text?.trim()) return heading.text.trim()

  const collected = piece.collectedItem
  if (typeof collected === 'object' && collected?.headline) return collected.headline
  return 'Untitled article'
}

export function briefIdOfPiece(piece: GeneratedPiece): string | null {
  if (!piece.brief) return null
  return typeof piece.brief === 'string' ? piece.brief : piece.brief.id
}

export function briefTitleOfPiece(piece: GeneratedPiece): string {
  const brief = piece.brief
  if (typeof brief === 'object' && brief?.title) return brief.title
  return 'Untitled brief'
}

export function briefItemIdOfPiece(piece: GeneratedPiece): string | null {
  const collected = piece.collectedItem as CollectedItem | string | null
  if (!collected || typeof collected === 'string') return null
  const briefItem = collected.briefItem
  if (!briefItem) return null
  return typeof briefItem === 'string' ? briefItem : briefItem.id
}

export type BriefPieceGroup = {
  briefId: string
  briefTitle: string
  pieces: GeneratedPiece[]
}

/** Group pieces under their parent brief (latest briefs first by newest piece). */
export function groupPiecesByBrief(pieces: GeneratedPiece[]): BriefPieceGroup[] {
  const map = new Map<string, BriefPieceGroup>()
  for (const piece of pieces) {
    const briefId = briefIdOfPiece(piece) ?? 'unknown'
    const existing = map.get(briefId)
    if (existing) {
      existing.pieces.push(piece)
    } else {
      map.set(briefId, {
        briefId,
        briefTitle: briefTitleOfPiece(piece),
        pieces: [piece],
      })
    }
  }
  return [...map.values()]
}

export function toBriefArticleRows(
  pieces: GeneratedPiece[],
  topicByItemId: Record<string, string>,
): Array<{
  id: string
  headline: string
  topic?: string
  attributionString?: string
  createdAt?: string
  coverImageDataUrl?: string | null
}> {
  return pieces.map((piece) => {
    const briefItemId = briefItemIdOfPiece(piece)
    return {
      id: piece.id,
      headline: pieceHeadline(piece),
      topic: briefItemId ? topicByItemId[briefItemId] : undefined,
      attributionString: piece.attributionString,
      createdAt: piece.createdAt,
      coverImageDataUrl: piece.coverImageDataUrl,
    }
  })
}

/** Latest piece id per brief-item (pieces should already be sorted newest-first). */
export function latestPieceIdByBriefItem(pieces: GeneratedPiece[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const piece of pieces) {
    const briefItemId = briefItemIdOfPiece(piece)
    if (briefItemId && !map[briefItemId]) map[briefItemId] = piece.id
  }
  return map
}
