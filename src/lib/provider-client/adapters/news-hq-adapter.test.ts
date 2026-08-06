import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import axios from 'axios'
import { fetchNewsHqProvider } from './news-hq-adapter'
import type { NewsHqProviderConfig, ProviderQuery } from '../types'

const provider: NewsHqProviderConfig = {
  type: 'newsHq',
  id: 'provider-newshq',
  name: 'TRT NewsHQ',
  baseUrl: 'https://newshq.internal/search',
  agencies: ['reuters', 'ap'],
}

const query: ProviderQuery = {
  channelId: 'channel-1',
  language: 'en',
  searchQuery: 'ceasefire',
  keywordsIncluded: ['gaza', 'ceasefire'],
  keywordsExcluded: ['sports'],
  priority: 'high',
}

describe('fetchNewsHqProvider', () => {
  afterEach(() => {
    ;(axios.get as any).mockRestore?.()
  })

  test('sends comma-joined filters matching NewsHQSearchApi.searchNews', async () => {
    const getSpy = spyOn(axios, 'get').mockResolvedValue({
      data: { data: [], total: 0, hasMore: false },
    })

    await fetchNewsHqProvider(provider, query)

    expect(getSpy).toHaveBeenCalledWith(
      provider.baseUrl,
      expect.objectContaining({
        params: expect.objectContaining({
          lang: 'en',
          agency: 'reuters,ap',
          keywordsInclude: 'gaza,ceasefire',
          keywordsExclude: 'sports',
          priority: 'high',
          searchQuery: 'ceasefire',
        }),
      }),
    )
  })

  test('normalizes items, falling back to description when content is absent', async () => {
    spyOn(axios, 'get').mockResolvedValue({
      data: {
        data: [
          {
            _id: 'item-1',
            title: 'Ceasefire talks resume',
            date: '2026-08-06T08:00:00.000Z',
            source: 'Reuters',
            language: 'en',
            content: 'Full article body.',
          },
          {
            _id: 'item-2',
            title: 'No full body yet',
            description: 'Short description only.',
          },
        ],
        total: 2,
        hasMore: false,
      },
    })

    const items = await fetchNewsHqProvider(provider, query)

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      providerId: 'provider-newshq',
      providerItemId: 'item-1',
      source: 'Reuters',
      headline: 'Ceasefire talks resume',
      body: 'Full article body.',
    })
    expect(items[1]).toMatchObject({ providerItemId: 'item-2', body: 'Short description only.' })
  })
})
