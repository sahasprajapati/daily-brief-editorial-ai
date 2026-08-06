import { describe, expect, test } from 'bun:test'
import type { GeneratedPiece } from '@/payload-types'
import {
  groupPiecesByBrief,
  latestPieceIdByBriefItem,
  pieceHeadline,
} from './pieces'

describe('pieceHeadline', () => {
  test('uses the generated heading block', () => {
    const piece = {
      currentBody: [{ type: 'heading', text: 'Generated title', blockId: '1' }],
      collectedItem: { headline: 'Wire headline' },
    } as unknown as GeneratedPiece
    expect(pieceHeadline(piece)).toBe('Generated title')
  })
})

describe('groupPiecesByBrief', () => {
  test('aggregates pieces under brief titles', () => {
    const pieces = [
      {
        id: 'p1',
        brief: { id: 'b1', title: 'Morning brief' },
        collectedItem: { headline: 'A' },
        generatedSnapshot: [{ type: 'heading', text: 'Article A', blockId: '1' }],
      },
      {
        id: 'p2',
        brief: { id: 'b1', title: 'Morning brief' },
        collectedItem: { headline: 'B' },
        generatedSnapshot: [{ type: 'heading', text: 'Article B', blockId: '2' }],
      },
      {
        id: 'p3',
        brief: { id: 'b2', title: 'Evening brief' },
        collectedItem: { headline: 'C' },
        generatedSnapshot: [{ type: 'heading', text: 'Article C', blockId: '3' }],
      },
    ] as unknown as GeneratedPiece[]

    const groups = groupPiecesByBrief(pieces)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ briefId: 'b1', briefTitle: 'Morning brief' })
    expect(groups[0].pieces.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(groups[1].briefId).toBe('b2')
  })
})

describe('latestPieceIdByBriefItem', () => {
  test('keeps the first (newest) piece per brief item', () => {
    const pieces = [
      {
        id: 'newer',
        collectedItem: { briefItem: 'item-1' },
      },
      {
        id: 'older',
        collectedItem: { briefItem: 'item-1' },
      },
      {
        id: 'other',
        collectedItem: { briefItem: { id: 'item-2' } },
      },
    ] as unknown as GeneratedPiece[]

    expect(latestPieceIdByBriefItem(pieces)).toEqual({
      'item-1': 'newer',
      'item-2': 'other',
    })
  })
})
