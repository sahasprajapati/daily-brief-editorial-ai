import axios from 'axios'
import type { NewsHqProviderConfig, NormalizedProviderItem, ProviderQuery } from '../types'

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
