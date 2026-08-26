import axios from 'axios'
import type { NewsHqProviderConfig, NormalizedProviderItem, ProviderQuery } from '../types'
import { isNewsHqStub } from '../news-hq-url'

interface NewsHqItem {
  _id: string
  title?: string
  date?: string
  aggregationDate?: string
  source?: string
  author?: string
  description?: string
  language?: string
  priority?: string
  content?: string
}

interface NewsHqSearchResponse {
  data: NewsHqItem[]
  total: number
  hasMore: boolean
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/** Mirrors trt-global-discover-lab's NewsHQSearchApi.searchNews param shape exactly
 *  (src/lib/newsHQSearchApi.ts), so this can point at the same deployed service. */
export async function fetchNewsHqProvider(
  provider: NewsHqProviderConfig,
  query: ProviderQuery,
): Promise<NormalizedProviderItem[]> {
  if (isNewsHqStub(provider.baseUrl)) {
    return buildStubNewsHqItems(provider, query)
  }

  const params: Record<string, string | number> = {
    limit: query.limit ?? 20,
    dateTo: query.dateTo ?? isoDate(new Date()),
    lang: query.language,
  }
  if (provider.agencies?.length) params.agency = provider.agencies.join(',')
  if (query.keywordsIncluded?.length) params.keywordsInclude = query.keywordsIncluded.join(',')
  if (query.keywordsExcluded?.length) params.keywordsExclude = query.keywordsExcluded.join(',')
  if (query.priority) params.priority = query.priority
  if (query.dateFrom) params.dateFrom = query.dateFrom
  if (query.searchQuery) params.searchQuery = query.searchQuery

  try {
    const response = await axios.get<NewsHqSearchResponse>(provider.baseUrl, {
      params,
      timeout: 30000,
      headers: { Accept: 'application/json' },
    })

    return (response.data.data ?? []).map((item) => ({
      providerId: provider.id,
      providerItemId: item._id,
      source: item.source ?? provider.name,
      publishTimestamp: item.date ?? item.aggregationDate ?? new Date().toISOString(),
      language: item.language ?? query.language,
      headline: item.title ?? '',
      body: item.content ?? item.description ?? '',
      raw: item,
    }))
  } catch (err) {
    throw new Error(formatNewsHqHttpError(err, provider.baseUrl))
  }
}

// —— Stub mode (no NEWS_HQ_SEARCH_BASE_URL configured) ——
// Canned wire items from the same agencies TRT's real deck aggregates, so the source
// review UI is testable end-to-end before the internal service/creds are wired up.

const STUB_AGENCIES: Array<{ name: string; priority: string }> = [
  { name: 'Reuters', priority: '1' },
  { name: 'AP', priority: '1' },
  { name: 'AFP', priority: '2' },
  { name: 'Anadolu', priority: '2' },
]

// Headlines/bodies restate the topic verbatim, then add plausible attribution — the
// relevance judge is instructed to reject digests/advisories/"roundup of coverage" framing,
// so these need to read as an actual on-topic wire item, not a meta-description of one.
const STUB_HEADLINE_TEMPLATES: Array<(topic: string) => string> = [
  (t) => t,
  (t) => `${t}, officials say`,
  (t) => `${t} as situation develops`,
  (t) => `${t}: key details`,
]

const STUB_BODY_TEMPLATES: Array<(topic: string) => string> = [
  (t) => `${t}. Officials said the situation continues to develop, with further details expected as the story unfolds.`,
  (t) => `${t}, according to sources close to the matter. The development follows related activity earlier in the region.`,
  (t) => `${t}. Correspondents on the ground report additional developments are likely in the coming hours.`,
  (t) => `${t}. Analysts say the development carries significant implications for the region.`,
]

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'story'
}

function buildStubNewsHqItems(
  provider: NewsHqProviderConfig,
  query: ProviderQuery,
): NormalizedProviderItem[] {
  // Prefer the full topic (searchQuery) over a single keyword layer — a whole sentence
  // reads as a real, specific headline; one bare keyword doesn't.
  const topic = query.searchQuery?.trim() || query.keywordsIncluded?.[0]?.trim() || 'this story'
  const now = Date.now()

  return STUB_AGENCIES.map((agency, index) => {
    const headline = STUB_HEADLINE_TEMPLATES[index % STUB_HEADLINE_TEMPLATES.length](topic)
    const body = STUB_BODY_TEMPLATES[index % STUB_BODY_TEMPLATES.length](topic)
    const publishTimestamp = new Date(now - index * 41 * 60 * 1000).toISOString()
    const providerItemId = `stub-${agency.name.toLowerCase()}-${slugify(topic)}`
    const raw: NewsHqItem = {
      _id: providerItemId,
      title: headline,
      date: publishTimestamp,
      source: agency.name,
      language: query.language,
      priority: agency.priority,
      content: body,
    }
    return {
      providerId: provider.id,
      providerItemId,
      source: agency.name,
      publishTimestamp,
      language: query.language,
      headline,
      body,
      raw,
    }
  })
}

function formatNewsHqHttpError(err: unknown, baseUrl: string): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    if (status === 403) {
      return `NewsHQ returned 403 Forbidden for ${baseUrl}. This host is likely IP-restricted — use TRT VPN/network, or point NEWS_HQ_SEARCH_BASE_URL at a reachable search endpoint.`
    }
    if (status) {
      return `NewsHQ HTTP ${status} for ${baseUrl}: ${err.message}`
    }
    return `NewsHQ request failed for ${baseUrl}: ${err.message}`
  }
  return err instanceof Error ? err.message : 'NewsHQ request failed'
}
