import { describe, expect, spyOn, test } from 'bun:test'
import * as gemini from './gemini'
import { runPreQaChecks } from './index'

const naturalnessResult = {
  naturalnessScore: 80,
  overallScore: 75,
  reasoning: 'Reads well.',
  suggestions: ['Tighten the intro.'],
}

describe('runPreQaChecks', () => {
  test('combines banned-term flags with the naturalness check result', async () => {
    spyOn(gemini, 'runNaturalnessCheck').mockResolvedValue(naturalnessResult)

    const blocks = [{ blockId: 'b1', type: 'paragraph' as const, text: 'The flood continued today.' }]
    const result = await runPreQaChecks(blocks, ['flood'])

    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toMatchObject({ blockId: 'b1', rule: 'no-banned-terms' })
    expect(result.naturalnessScore).toBe(80)
    expect(result.overallScore).toBe(75)
    expect(result.suggestions).toEqual(['Tighten the intro.'])
  })

  test('returns no flags when no banned terms match', async () => {
    spyOn(gemini, 'runNaturalnessCheck').mockResolvedValue(naturalnessResult)

    const blocks = [{ blockId: 'b1', type: 'paragraph' as const, text: 'Clean text.' }]
    const result = await runPreQaChecks(blocks, [])

    expect(result.flags).toEqual([])
  })

  test('degrades gracefully when the naturalness check throws', async () => {
    spyOn(gemini, 'runNaturalnessCheck').mockRejectedValue(new Error('no api key'))

    const blocks = [{ blockId: 'b1', type: 'paragraph' as const, text: 'The flood continued today.' }]
    const result = await runPreQaChecks(blocks, ['flood'])

    expect(result.flags).toHaveLength(1)
    expect(result.naturalnessUnavailable).toBe(true)
    expect(result.suggestions).toEqual([])
  })
})
