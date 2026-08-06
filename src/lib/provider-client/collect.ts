import { fetchEventRegistryProvider } from './adapters/event-registry-adapter'
import { fetchNewsHqProvider } from './adapters/news-hq-adapter'
import type { CollectResult, NormalizedProviderItem, ProviderConfig, ProviderQuery } from './types'

function fetchProviderItems(provider: ProviderConfig, query: ProviderQuery): Promise<NormalizedProviderItem[]> {
  switch (provider.type) {
    case 'newsHq':
      return fetchNewsHqProvider(provider, query)
    case 'eventRegistry':
      return fetchEventRegistryProvider(provider, query)
    default: {
      const exhaustiveCheck: never = provider
      return Promise.reject(new Error(`Unsupported provider type: ${(exhaustiveCheck as ProviderConfig).type}`))
    }
  }
}

/** Queries every given provider concurrently; one provider failing never blocks the others -
 *  each outcome lands in either `results` or `failures`. */
export async function collectFromProviders(
  providers: ProviderConfig[],
  query: ProviderQuery,
): Promise<CollectResult> {
  const settled = await Promise.allSettled(providers.map((provider) => fetchProviderItems(provider, query)))

  const result: CollectResult = { results: [], failures: [] }

  settled.forEach((outcome, index) => {
    const provider = providers[index]
    if (outcome.status === 'fulfilled') {
      result.results.push({ providerId: provider.id, providerName: provider.name, items: outcome.value })
    } else {
      const error = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
      result.failures.push({ providerId: provider.id, providerName: provider.name, error })
    }
  })

  return result
}
