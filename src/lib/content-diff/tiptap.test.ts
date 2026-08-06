import { describe, expect, test } from 'bun:test'
import type { ContentBlock } from './types'
import { contentBlocksToTiptap, tiptapToContentBlocks } from './tiptap'

describe('contentBlocksToTiptap / tiptapToContentBlocks', () => {
  test('round-trips heading and paragraph with stable ids', () => {
    const blocks: ContentBlock[] = [
      { blockId: 'h1', type: 'heading', text: 'Title here' },
      { blockId: 'p1', type: 'paragraph', text: 'Body copy.' },
    ]
    const doc = contentBlocksToTiptap(blocks)
    expect(doc.content?.[0]).toMatchObject({
      type: 'heading',
      attrs: { id: 'h1', level: 2 },
    })
    expect(tiptapToContentBlocks(doc)).toEqual(blocks)
  })

  test('flattens list items into paragraphs', () => {
    const blocks = tiptapToContentBlocks({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', attrs: { id: 'li1' }, content: [{ type: 'text', text: 'One' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Two' }] }],
            },
          ],
        },
      ],
    })
    expect(blocks[0]).toMatchObject({ blockId: 'li1', type: 'paragraph', text: 'One' })
    expect(blocks[1].text).toBe('Two')
    expect(blocks[1].blockId).toBeTruthy()
  })

  test('preserves bold text as plain text for QA offsets', () => {
    const blocks = tiptapToContentBlocks({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { id: 'p-bold' },
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'world', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    })
    expect(blocks).toEqual([{ blockId: 'p-bold', type: 'paragraph', text: 'Hello world' }])
  })
})
