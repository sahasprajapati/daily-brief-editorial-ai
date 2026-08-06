import { describe, expect, test } from 'bun:test'
import { diffBlockSnapshots } from './diff'
import type { ContentBlock } from './types'

const unchangedBlock: ContentBlock = { blockId: 'b1', type: 'paragraph', text: 'This stays the same.' }

describe('diffBlockSnapshots', () => {
  test('marks a block with matching id and identical text as unchanged', () => {
    const [entry] = diffBlockSnapshots([unchangedBlock], [unchangedBlock])

    expect(entry).toEqual({ blockId: 'b1', status: 'unchanged', type: 'paragraph', text: unchangedBlock.text })
  })

  test('marks a block with matching id and different text as changed, with word-level diff html', () => {
    const before: ContentBlock = { blockId: 'b1', type: 'paragraph', text: 'The quick fox jumps.' }
    const after: ContentBlock = { blockId: 'b1', type: 'paragraph', text: 'The quick brown fox jumps.' }

    const [entry] = diffBlockSnapshots([before], [after])

    expect(entry.status).toBe('changed')
    expect(entry.text).toBe(after.text)
    expect(entry.diffHtml).toContain('brown')
    expect(entry.diffHtml).toMatch(/<ins/)
  })

  test('marks a block only present in "after" as added', () => {
    const after: ContentBlock = { blockId: 'new', type: 'paragraph', text: 'Brand new paragraph.' }

    const [entry] = diffBlockSnapshots([], [after])

    expect(entry).toEqual({ blockId: 'new', status: 'added', type: 'paragraph', text: after.text })
  })

  test('marks a block only present in "before" as removed, appended after the surviving blocks', () => {
    const removedBlock: ContentBlock = { blockId: 'gone', type: 'paragraph', text: 'This got deleted.' }

    const result = diffBlockSnapshots([unchangedBlock, removedBlock], [unchangedBlock])

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ blockId: 'b1', status: 'unchanged' })
    expect(result[1]).toEqual({ blockId: 'gone', status: 'removed', type: 'paragraph', text: removedBlock.text })
  })

  test('handles a realistic multi-block revision in one pass', () => {
    const before: ContentBlock[] = [
      { blockId: 'b1', type: 'paragraph', text: 'Ceasefire talks resume today.' },
      { blockId: 'b2', type: 'paragraph', text: 'Markets reacted calmly.' },
    ]
    const after: ContentBlock[] = [
      { blockId: 'b1', type: 'paragraph', text: 'Ceasefire talks resume today in Cairo.' },
      { blockId: 'b3', type: 'paragraph', text: 'A new closing paragraph.' },
    ]

    const result = diffBlockSnapshots(before, after)

    expect(result.map((e) => [e.blockId, e.status])).toEqual([
      ['b1', 'changed'],
      ['b3', 'added'],
      ['b2', 'removed'],
    ])
  })
})
