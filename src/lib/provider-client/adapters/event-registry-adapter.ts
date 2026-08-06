import axios from 'axios'
import type { EventRegistryProviderConfig, NormalizedProviderItem, ProviderQuery } from '../types'

interface EventRegistrySource {
  uri?: string
  title?: string
}

interface EventRegistryArticle {
  uri: string
  title: string
  body: string
  url: string
  image?: string
  dateTime?: string
  date?: string
  lang?: string
  source?: EventRegistrySource
}

interface EventRegistryResponse {
  articles?: { results?: EventRegistryArticle[] }
}

function isoDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}

/** Mirrors the request shape the trt-editorial-n8n prototype already sends to
 *  eventregistry.org/api/v1/article/getArticles (trt-daily-editorial.json, node "Event
 *  Registry Search"). */
export async function fetchEventRegistryProvider(
  provider: EventRegistryProviderConfig,
  query: ProviderQuery,
): Promise<NormalizedProviderItem[]> {
  const apiKey = process.env[provider.apiKeyEnvVar]
  if (!apiKey) {
    throw new Error(`Missing Event Registry API key in env var "${provider.apiKeyEnvVar}"`)
  }

  const keyword = [query.searchQuery, ...(query.keywordsIncluded ?? [])].filter(Boolean)

  const response = await axios.post<EventRegistryResponse>(provider.baseUrl, {
    action: 'getArticles',
    keyword,
    keywordOper: 'and',
    keywordsLoc: 'body,title',
    articlesCount: query.limit ?? 10,
    articlesSortBy: 'date',
    articlesSortByAsc: false,
    dateStart: query.dateFrom ?? isoDaysAgo(2),
    dateEnd: query.dateTo ?? isoDaysAgo(0),
    resultType: 'articles',
    dataType: ['news'],
    lang: [query.language],
    apiKey,
  })

  const articles = response.data.articles?.results ?? []

  return articles.map((article) => ({
    providerId: provider.id,
    providerItemId: article.uri,
    source: article.source?.title ?? provider.name,
    publishTimestamp: article.dateTime ?? article.date ?? new Date().toISOString(),
    language: article.lang ?? query.language,
    headline: article.title,
    body: article.body,
    sourceUrl: article.url,
    raw: article,
  }))
}
