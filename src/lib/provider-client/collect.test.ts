import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { collectFromProviders } from './collect'
import * as newsHqAdapter from './adapters/news-hq-adapter'
import * as eventRegistryAdapter from './adapters/event-registry-adapter'
import type { EventRegistryProviderConfig, NewsHqProviderConfig, ProviderQuery } from './types'

const newsHqProvider: NewsHqProviderConfig = {
  type: 'newsHq',
  id: 'provider-newshq',
  name: 'TRT NewsHQ',
  baseUrl: 'https://newshq.internal/search',
}

const eventRegistryProvider: EventRegistryProviderConfig = {
  type: 'eventRegistry',
  id: 'provider-er',
  name: 'Event Registry',
  baseUrl: 'https://eventregistry.org/api/v1/article/getArticles',
  apiKeyEnvVar: 'TEST_ER_API_KEY',
}

const query: ProviderQuery = { channelId: 'channel-1', language: 'en', searchQuery: 'ceasefire' }

describe('collectFromProviders', () => {
  afterEach(() => {
    ;(newsHqAdapter.fetchNewsHqProvider as any).mockRestore?.()
    ;(eventRegistryAdapter.fetchEventRegistryProvider as any).mockRestore?.()
  })

  test('dispatches each provider by type and returns normalized results for all of them', async () => {
    spyOn(newsHqAdapter, 'fetchNewsHqProvider').mockResolvedValue([
      {
        providerId: 'provider-newshq',
        providerItemId: '1',
        source: 'Reuters',
        publishTimestamp: '',
        language: 'en',
        headline: 'A',
        body: 'Body A',
        raw: {},
      },
    ])
    spyOn(eventRegistryAdapter, 'fetchEventRegistryProvider').mockResolvedValue([
      {
        providerId: 'provider-er',
        providerItemId: '2',
        source: 'AP',
        publishTimestamp: '',
        language: 'en',
        headline: 'B',
        body: 'Body B',
        raw: {},
      },
    ])

    const result = await collectFromProviders([newsHqProvider, eventRegistryProvider], query)

    expect(result.failures).toEqual([])
    expect(result.results.map((r) => r.providerId)).toEqual(['provider-newshq', 'provider-er'])
  })

  test('isolates a failing provider: the other still returns, the failure is reported', async () => {
    spyOn(newsHqAdapter, 'fetchNewsHqProvider').mockRejectedValue(new Error('timeout'))
    spyOn(eventRegistryAdapter, 'fetchEventRegistryProvider').mockResolvedValue([
      {
        providerId: 'provider-er',
        providerItemId: '2',
        source: 'AP',
        publishTimestamp: '',
        language: 'en',
        headline: 'B',
        body: 'Body B',
        raw: {},
      },
    ])

    const result = await collectFromProviders([newsHqProvider, eventRegistryProvider], query)

    expect(result.failures).toEqual([{ providerId: 'provider-newshq', providerName: 'TRT NewsHQ', error: 'timeout' }])
    expect(result.results.map((r) => r.providerId)).toEqual(['provider-er'])
  })
})
