import { describe, expect, test } from 'bun:test'
import type { ContentBlock } from '@/lib/content-diff'
import { resolveSuggestionAnchors } from './resolve'
import type { QaSuggestion } from './types'

const blocks: ContentBlock[] = [
  { blockId: 'h1', type: 'heading', text: 'Iran blockade tightens' },
  { blockId: 'p1', type: 'paragraph', text: 'US forces redirected 55 commercial vessels yesterday.' },
]

function suggestion(partial: Partial<QaSuggestion> & Pick<QaSuggestion, 'quote' | 'blockId' | 'startOffset' | 'endOffset'>): QaSuggestion {
  return {
    id: partial.id ?? 's1',
    message: partial.message ?? 'Clarify attribution.',
    severity: partial.severity ?? 'softFail',
    createdAt: partial.createdAt ?? '2026-08-10T00:00:00.000Z',
    ...partial,
  }
}

describe('resolveSuggestionAnchors', () => {
  test('exact offset match', () => {
    const [anchor] = resolveSuggestionAnchors(blocks, [
      suggestion({
        quote: '55 commercial vessels',
        blockId: 'p1',
        startOffset: 21,
        endOffset: 42,
      }),
    ])
    expect(anchor.status).toBe('exact')
    expect(anchor.startOffset).toBe(21)
    expect(anchor.endOffset).toBe(42)
  })

  test('relocates when quote moved within the block', () => {
    const moved: ContentBlock[] = [
      { blockId: 'p1', type: 'paragraph', text: 'Yesterday, US forces redirected 55 commercial vessels.' },
    ]
    const [anchor] = resolveSuggestionAnchors(moved, [
      suggestion({
        quote: '55 commercial vessels',
        blockId: 'p1',
        startOffset: 21,
        endOffset: 42,
      }),
    ])
    expect(anchor.status).toBe('relocated')
    expect(moved[0].text.slice(anchor.startOffset, anchor.endOffset)).toBe('55 commercial vessels')
  })

  test('text-changed keeps the block when quote is gone', () => {
    const rewritten: ContentBlock[] = [
      { blockId: 'p1', type: 'paragraph', text: 'The navy escorted dozens of tankers through the strait.' },
    ]
    const [anchor] = resolveSuggestionAnchors(rewritten, [
      suggestion({
        quote: '55 commercial vessels',
        blockId: 'p1',
        startOffset: 21,
        endOffset: 42,
      }),
    ])
    expect(anchor.status).toBe('text-changed')
    expect(anchor.startOffset).toBe(0)
    expect(anchor.endOffset).toBe(rewritten[0].text.length)
  })

  test('orphaned when block is missing', () => {
    const [anchor] = resolveSuggestionAnchors(blocks, [
      suggestion({
        quote: 'gone',
        blockId: 'missing',
        startOffset: 0,
        endOffset: 4,
      }),
    ])
    expect(anchor.status).toBe('orphaned')
  })
})
