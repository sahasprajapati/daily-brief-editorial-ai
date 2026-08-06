import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import * as gemini from './relevance-gemini'
import { filterRelevantNewsHqHits } from './relevance'

afterEach(() => {
  ;(gemini.runRelevanceCheck as any).mockRestore?.()
})

describe('filterRelevantNewsHqHits', () => {
  test('returns only ids marked relevant by the model', async () => {
    spyOn(gemini, 'runRelevanceCheck').mockResolvedValue([
      { providerItemId: 'a', relevant: true, reason: 'same story' },
      { providerItemId: 'b', relevant: false, reason: 'generic football' },
    ])

    const ids = await filterRelevantNewsHqHits({
      topic: 'Azerbaijan hosts football cup',
      keywords: ['Azerbaijan'],
      candidates: [
        { providerItemId: 'a', headline: 'Azerbaijan to host U-15 World Cup', body: '...', source: 'AFP' },
        { providerItemId: 'b', headline: 'College football coaches under pressure', body: '...', source: 'AP' },
      ],
    })

    expect(ids).toEqual(['a'])
  })

  test('returns empty when there are no candidates', async () => {
    expect(await filterRelevantNewsHqHits({ topic: 'T', keywords: [], candidates: [] })).toEqual([])
  })
})
