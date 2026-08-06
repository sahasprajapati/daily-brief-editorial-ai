import { describe, expect, test } from 'bun:test'
import {
  buildNewsHqKeywords,
  buildNewsHqKeywordLayers,
  filterAndRankNewsHqHits,
  isJunkNewsHqTitle,
  newsHqDateFrom,
  scoreNewsHqHit,
} from './news-hq-query'
import type { NormalizedProviderItem } from './types'

describe('buildNewsHqKeywords', () => {
  test('prefers one distinctive topic keyword for the URL filter', () => {
    expect(
      buildNewsHqKeywords({
        topic: 'Azerbaijan to Host First-Ever U-15 Football World Cup',
        keywords: ['Azerbaijan', 'Football', 'World Cup', 'unrelated'],
      }),
    ).toEqual(['Azerbaijan'])
  })

  test('falls back to capitalized entities from the topic', () => {
    expect(
      buildNewsHqKeywords({
        topic: 'Netanyahu Plane Flies Through European Airspace',
        keywords: [],
      }),
    ).toContain('Netanyahu')
  })

  test('prefers story-specific phrases over broad "US forces"', () => {
    expect(
      buildNewsHqKeywords({
        topic: 'US forces redirect 55 commercial vessels under strict Iran naval blockade',
        keywords: ['US forces', 'commercial vessels', 'Iran', 'naval blockade'],
      }),
    ).toEqual(['commercial vessels'])
  })

  test('keyword layers return multiple distinctive terms for multilayer search', () => {
    expect(
      buildNewsHqKeywordLayers(
        {
          topic: 'US forces redirect 55 commercial vessels under strict Iran naval blockade',
          keywords: ['US forces', 'commercial vessels', 'Iran', 'naval blockade'],
        },
        3,
      ),
    ).toEqual(['commercial vessels', 'naval blockade', 'Iran'])
  })
})

describe('newsHqDateFrom', () => {
  test('returns UTC date N days back', () => {
    expect(newsHqDateFrom(2, new Date('2026-08-10T12:00:00.000Z'))).toBe('2026-08-08')
  })
})

describe('filterAndRankNewsHqHits', () => {
  const base = {
    providerId: 'p',
    providerItemId: '1',
    source: 'AFP',
    publishTimestamp: '2026-08-10T00:00:00.000Z',
    language: 'en',
    raw: {},
  }

  test('drops digests and ranks topic overlap first', () => {
    const items: NormalizedProviderItem[] = [
      { ...base, providerItemId: 'a', headline: 'AP News Digest 6 a.m.', body: 'Azerbaijan mentioned' },
      {
        ...base,
        providerItemId: 'b',
        headline: 'Azerbaijan to host youth football tournament',
        body: 'Baku',
      },
      {
        ...base,
        providerItemId: 'c',
        headline: 'Unrelated stocks rally in Asia',
        body: 'markets',
      },
    ]

    const ranked = filterAndRankNewsHqHits(
      items,
      'Azerbaijan to Host First-Ever U-15 Football World Cup',
      ['Azerbaijan', 'Football'],
      5,
    )

    expect(ranked.map((i) => i.providerItemId)).toEqual(['b'])
    expect(isJunkNewsHqTitle('REUTERS NEWS SCHEDULE AT 10:15 a.m.')).toBe(true)
    expect(scoreNewsHqHit(items[1], 'Azerbaijan football', ['Azerbaijan'])).toBeGreaterThan(0)
  })
})
