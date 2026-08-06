export interface ProviderQuery {
  channelId: string
  language: string
  searchQuery?: string
  keywordsIncluded?: string[]
  keywordsExcluded?: string[]
  priority?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
}

export interface NormalizedProviderItem {
  providerId: string
  providerItemId: string
  source: string
  publishTimestamp: string
  language: string
  headline: string
  body: string
  sourceUrl?: string
  raw: unknown
}

/** TRT's internal wire-aggregation search, same filter shape as trt-global-cms-prod's
 *  newsHqDeck. Config just needs a base URL - agency/language/keyword filtering happens
 *  per-query, not per-provider-config. */
export interface NewsHqProviderConfig {
  type: 'newsHq'
  id: string
  name: string
  baseUrl: string
  agencies?: string[]
}

/** eventregistry.org / NewsAPI.ai. */
export interface EventRegistryProviderConfig {
  type: 'eventRegistry'
  id: string
  name: string
  baseUrl: string
  apiKeyEnvVar: string
}

export type ProviderConfig = NewsHqProviderConfig | EventRegistryProviderConfig

export interface ProviderFetchResult {
  providerId: string
  providerName: string
  items: NormalizedProviderItem[]
}

export interface ProviderFailure {
  providerId: string
  providerName: string
  error: string
}

export interface CollectResult {
  results: ProviderFetchResult[]
  failures: ProviderFailure[]
}
