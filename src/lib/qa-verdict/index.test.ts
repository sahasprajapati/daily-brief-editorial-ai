import { describe, expect, spyOn, test } from 'bun:test'
import * as openai from './openai'
import { runQaVerdictCheck } from './index'

const baseInput = {
  blocks: [{ blockId: 'b1', type: 'paragraph' as const, text: 'Ceasefire talks resumed today.' }],
  bannedTerms: [],
  angle: '',
  sentiment: '',
  portrayalNotes: '',
  requiredContext: '',
  guidelineSlug: null,
}

describe('runQaVerdictCheck', () => {
  test('rejects automatically on a banned-term hard-fail, without calling the AI', async () => {
    const aiSpy = spyOn(openai, 'runQaVerdictAi')

    const result = await runQaVerdictCheck({
      ...baseInput,
      blocks: [{ blockId: 'b1', type: 'paragraph', text: 'The illegal migrants crossed the border.' }],
      bannedTerms: ['illegal migrants'],
    })

    expect(result.verdict).toBe('rejected')
    expect(result.decidedBy).toBe('hardFailRule')
    expect(result.concerns).toHaveLength(1)
    expect(result.concerns[0].severity).toBe('hardFail')
    expect(aiSpy).not.toHaveBeenCalled()
    aiSpy.mockRestore()
  })

  test('uses the AI verdict when no hard-fail rule trips', async () => {
    spyOn(openai, 'runQaVerdictAi').mockResolvedValue({
      verdict: 'needsAttention',
      reasoning: 'Missing required context on aid figures.',
      concerns: [{ severity: 'softFail', message: 'No UN aid-access figures cited.' }],
    })

    const result = await runQaVerdictCheck(baseInput)

    expect(result.verdict).toBe('needsAttention')
    expect(result.decidedBy).toBe('ai')
    expect(result.concerns).toEqual([{ severity: 'softFail', message: 'No UN aid-access figures cited.' }])
    ;(openai.runQaVerdictAi as any).mockRestore()
  })

  test('degrades to needsAttention when the AI call throws', async () => {
    spyOn(openai, 'runQaVerdictAi').mockRejectedValue(new Error('no api key'))

    const result = await runQaVerdictCheck(baseInput)

    expect(result.verdict).toBe('needsAttention')
    expect(result.decidedBy).toBe('unavailable')
    ;(openai.runQaVerdictAi as any).mockRestore()
  })
})
