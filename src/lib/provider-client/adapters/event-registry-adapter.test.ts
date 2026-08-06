import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import axios from 'axios'
import { fetchEventRegistryProvider } from './event-registry-adapter'
import type { EventRegistryProviderConfig, ProviderQuery } from '../types'

const provider: EventRegistryProviderConfig = {
  type: 'eventRegistry',
  id: 'provider-er',
  name: 'Event Registry',
  baseUrl: 'https://eventregistry.org/api/v1/article/getArticles',
  apiKeyEnvVar: 'TEST_ER_API_KEY',
}

const query: ProviderQuery = {
  channelId: 'channel-1',
  language: 'eng',
  searchQuery: 'ceasefire',
}

describe('fetchEventRegistryProvider', () => {
  afterEach(() => {
    ;(axios.post as any).mockRestore?.()
    delete process.env.TEST_ER_API_KEY
  })

  test('throws when the configured API key env var is unset', async () => {
    await expect(fetchEventRegistryProvider(provider, query)).rejects.toThrow(
      'Missing Event Registry API key in env var "TEST_ER_API_KEY"',
    )
  })

  test('posts the getArticles request shape and normalizes results', async () => {
    process.env.TEST_ER_API_KEY = 'secret'
    const postSpy = spyOn(axios, 'post').mockResolvedValue({
      data: {
        articles: {
          results: [
            {
              uri: 'article-1',
              title: 'Ceasefire talks resume in Cairo',
              body: 'Full body text.',
              url: 'https://example.test/article-1',
              dateTime: '2026-08-06T08:00:00Z',
              lang: 'eng',
              source: { title: 'Reuters' },
            },
          ],
        },
      },
    })

    const items = await fetchEventRegistryProvider(provider, query)

    expect(postSpy).toHaveBeenCalledWith(
      provider.baseUrl,
      expect.objectContaining({
        action: 'getArticles',
        keyword: ['ceasefire'],
        keywordOper: 'and',
        apiKey: 'secret',
        lang: ['eng'],
      }),
    )
    expect(items).toEqual([
      {
        providerId: 'provider-er',
        providerItemId: 'article-1',
        source: 'Reuters',
        publishTimestamp: '2026-08-06T08:00:00Z',
        language: 'eng',
        headline: 'Ceasefire talks resume in Cairo',
        body: 'Full body text.',
        sourceUrl: 'https://example.test/article-1',
        raw: expect.any(Object),
      },
    ])
  })
})
