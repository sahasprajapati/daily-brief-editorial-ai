import { describe, expect, spyOn, test } from 'bun:test'
import * as openai from './openai'
import { EmptyBriefError, extractBrief } from './index'

describe('extractBrief', () => {
  test('returns the extracted items on success', async () => {
    const items = [
      {
        topic: 'Gaza ceasefire talks',
        sectionTitle: 'GAZA & PALESTINE',
        format: 'News',
        keywords: ['Gaza', 'ceasefire'],
        angle: 'Focus on the mediation effort',
        priorityOrder: 1,
        region: 'Middle East',
        exclusions: [],
        sentiment: 'sympathetic',
        portrayalNotes: 'Avoid euphemisms',
        bannedTerms: [],
        requiredContext: 'Current death toll',
      },
    ]
    spyOn(openai, 'runExtraction').mockResolvedValue({ items })

    const result = await extractBrief('some raw brief text')

    expect(result).toEqual(items)
  })

  test('throws EmptyBriefError and persists nothing when zero topics are extracted', async () => {
    spyOn(openai, 'runExtraction').mockResolvedValue({ items: [] })

    await expect(extractBrief('empty text')).rejects.toThrow(EmptyBriefError)
  })
})
