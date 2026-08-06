import { describe, expect, test } from 'bun:test'
import { checkNoBannedTerms } from './no-banned-terms'

describe('checkNoBannedTerms', () => {
  test('flags a block containing a banned term, case-insensitively', () => {
    const blocks = [{ blockId: 'b1', type: 'paragraph' as const, text: 'The flood of illegal migrants continued.' }]
    const flags = checkNoBannedTerms(blocks, ['illegal migrants', 'flood'])
    expect(flags).toHaveLength(2)
    expect(flags[0]).toMatchObject({ blockId: 'b1', rule: 'no-banned-terms', severity: 'hardFail' })
  })

  test('returns no flags when no banned term appears', () => {
    const blocks = [{ blockId: 'b1', type: 'paragraph' as const, text: 'Undocumented migrants arrived today.' }]
    expect(checkNoBannedTerms(blocks, ['illegal migrants', 'flood'])).toEqual([])
  })

  test('returns no flags when bannedTerms is empty', () => {
    const blocks = [{ blockId: 'b1', type: 'paragraph' as const, text: 'Anything goes here.' }]
    expect(checkNoBannedTerms(blocks, [])).toEqual([])
  })
})
