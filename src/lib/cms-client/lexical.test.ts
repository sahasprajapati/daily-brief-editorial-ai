import { describe, expect, test } from 'bun:test'
import { plainTextToLexicalJSON } from './lexical'

describe('plainTextToLexicalJSON', () => {
  test('wraps each paragraph in its own paragraph node with a single text child', () => {
    const result = plainTextToLexicalJSON(['First paragraph.', 'Second paragraph.'])

    expect(result.root.children).toHaveLength(2)
    expect(result.root.children[0].type).toBe('paragraph')
    expect(result.root.children[0].children[0]).toMatchObject({ type: 'text', text: 'First paragraph.' })
    expect(result.root.children[1].children[0]).toMatchObject({ type: 'text', text: 'Second paragraph.' })
  })

  test('drops empty paragraphs', () => {
    const result = plainTextToLexicalJSON(['Real text.', '', '   '.trim()])

    expect(result.root.children).toHaveLength(1)
  })

  test('produces a valid empty root for no paragraphs', () => {
    const result = plainTextToLexicalJSON([])

    expect(result.root.type).toBe('root')
    expect(result.root.children).toEqual([])
  })
})
