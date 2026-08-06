import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import type { BriefItem, EditorialBrief, Provider, User } from '@/payload-types'
import * as newsHqAdapter from '@/lib/provider-client/adapters/news-hq-adapter'
import * as newsHqFilters from '@/lib/provider-client/news-hq-filters'
import * as relevance from './relevance'
import { collectForBriefItem } from './index'

afterEach(() => {
  ;(newsHqAdapter.fetchNewsHqProvider as any).mockRestore?.()
  ;(newsHqFilters.fetchNewsHqFilters as any).mockRestore?.()
  ;(relevance.filterRelevantNewsHqHits as any).mockRestore?.()
})

const user = { id: 'lead-1', role: 'editor' } as User
const briefItem = {
  id: 'item-1',
  topic: 'Gaza ceasefire',
  keywords: ['Gaza'],
  status: 'pending',
} as unknown as BriefItem
const brief = { id: 'brief-1', channel: 'ch-1' } as EditorialBrief

const provider = {
  id: 'provider-newshq',
  name: 'TRT NewsHQ',
  type: 'newsHq',
  enabled: true,
  baseUrl: 'https://example.test/api/v1/news',
  channels: [],
} as unknown as Provider

function fakePayload({
  providers = [provider],
  channelConfigs = [] as any[],
  settings = { agencies: ['AFP'], priorities: ['1', '2', '3', '4'], defaultLang: 'en', limit: 20 },
  existingCollected = [] as any[],
} = {}) {
  const created: any[] = []
  const updated: any[] = []
  return {
    created,
    updated,
    payload: {
      find: async ({ collection }: any) => {
        if (collection === 'providers') return { docs: providers }
        if (collection === 'channel-configs') return { docs: channelConfigs }
        if (collection === 'collected-items') return { docs: existingCollected }
        return { docs: [] }
      },
      findGlobal: async () => settings,
      create: async ({ collection, data }: any) => {
        if (collection === 'providers') {
          const doc = { id: 'provider-newshq', ...data }
          return doc
        }
        const doc = { id: `collected-${created.length}`, ...data }
        created.push(doc)
        return doc
      },
      update: async ({ collection, id, data }: any) => {
        updated.push({ collection, id, data })
        return { id, ...data }
      },
    },
  }
}

function fakeCmsClient(existingHeadlines: string[] = []) {
  return {
    searchContent: async (query: string) =>
      existingHeadlines.includes(query) ? [{ id: 'existing-1', title: query }] : [],
  } as any
}

describe('collectForBriefItem', () => {
  test('creates candidate collected-items from NewsHQ and marks brief-item queried', async () => {
    process.env.NEWS_HQ_SEARCH_BASE_URL = 'https://example.test'
    spyOn(newsHqAdapter, 'fetchNewsHqProvider').mockResolvedValue([
      {
        providerId: 'provider-newshq',
        providerItemId: 'ext-1',
        source: 'AFP',
        publishTimestamp: '2026-08-10T00:00:00.000Z',
        language: 'en',
        headline: 'Gaza ceasefire talks resume',
        body: 'Body text about Gaza',
        raw: {},
      },
    ])
    spyOn(relevance, 'filterRelevantNewsHqHits').mockResolvedValue(['ext-1'])

    const { payload, created, updated } = fakePayload()
    const result = await collectForBriefItem(payload as any, user, fakeCmsClient(), briefItem, brief)

    expect(result.status).toBe('queried')
    expect(result.collectedItems).toHaveLength(1)
    expect(created[0]).toMatchObject({
      briefItem: 'item-1',
      headline: 'Gaza ceasefire talks resume',
      reviewStatus: 'candidate',
    })
    expect(updated.some((u) => u.id === 'item-1' && u.data.status === 'queried')).toBe(true)
  })

  test('skips CMS duplicates and marks no-results when nothing remains', async () => {
    process.env.NEWS_HQ_SEARCH_BASE_URL = 'https://example.test'
    spyOn(newsHqAdapter, 'fetchNewsHqProvider').mockResolvedValue([
      {
        providerId: 'provider-newshq',
        providerItemId: 'ext-1',
        source: 'AFP',
        publishTimestamp: '2026-08-10T00:00:00.000Z',
        language: 'en',
        headline: 'Already published',
        body: 'Body text',
        raw: {},
      },
    ])

    const { payload, created, updated } = fakePayload()
    const result = await collectForBriefItem(
      payload as any,
      user,
      fakeCmsClient(['Already published']),
      briefItem,
      brief,
    )

    expect(result.status).toBe('no-results')
    expect(created).toHaveLength(0)
    expect(updated[0]).toMatchObject({ id: 'item-1', data: { status: 'no-results' } })
  })

  test('marks error when NewsHQ fetch throws', async () => {
    process.env.NEWS_HQ_SEARCH_BASE_URL = 'https://example.test'
    spyOn(newsHqAdapter, 'fetchNewsHqProvider').mockRejectedValue(new Error('timeout'))
    spyOn(newsHqFilters, 'fetchNewsHqFilters').mockResolvedValue({
      languages: ['en'],
      agencies: ['AFP'],
      priorities: ['1'],
      providersByLanguage: { en: ['AFP'] },
    })

    const { payload, updated } = fakePayload()
    const result = await collectForBriefItem(payload as any, user, fakeCmsClient(), briefItem, brief)

    expect(result.status).toBe('error')
    expect(updated[0]).toMatchObject({ id: 'item-1', data: { status: 'error' } })
  })
})
