import { describe, expect, test } from 'bun:test'
import { createBlocks } from './blocks'

describe('createBlocks', () => {
  test('mints one block per paragraph with a unique blockId', () => {
    const blocks = createBlocks(['First.', 'Second.'])

    expect(blocks).toHaveLength(2)
    expect(blocks[0].text).toBe('First.')
    expect(blocks[1].text).toBe('Second.')
    expect(blocks[0].blockId).not.toBe(blocks[1].blockId)
    expect(blocks[0].type).toBe('paragraph')
  })

  test('drops empty paragraphs', () => {
    expect(createBlocks(['Real text.', ''])).toHaveLength(1)
  })

  test('accepts a block type override', () => {
    const blocks = createBlocks(['Title'], 'heading')
    expect(blocks[0].type).toBe('heading')
  })
})
