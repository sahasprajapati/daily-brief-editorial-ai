import type { Payload } from 'payload'
import type { BriefItem, CollectedItem, EditorialBrief, Provider, User } from '@/payload-types'
import { fetchNewsHqProvider } from '@/lib/provider-client'
import type { NewsHqProviderConfig } from '@/lib/provider-client'
import type { CmsClient } from '@/lib/cms-client'
import { fetchNewsHqFilters } from '@/lib/provider-client/news-hq-filters'
import {
  buildNewsHqKeywordLayers,
  buildNewsHqRankTerms,
  filterAndRankNewsHqHits,
  newsHqDateFrom,
} from '@/lib/provider-client/news-hq-query'
import { resolveNewsHqBaseUrl, toNewsHqLang } from '@/lib/provider-client/news-hq-url'
import { filterRelevantNewsHqHits } from './relevance'

/** Hard cap for sources shown per topic after ranking + LLM. */
export const NEWSHQ_RESULT_LIMIT = 5
/** How many wires to pull from NewsHQ per keyword layer before filtering. */
export const NEWSHQ_FETCH_LIMIT = 50
/** Max candidates sent to the LLM relevance judge. */
export const NEWSHQ_LLM_SHORTLIST = 25
/** Separate NewsHQ queries for the top N ranked keywords, then merge. */
export const NEWSHQ_SEARCH_LAYERS = 3

async function ensureNewsHqProvider(payload: Payload): Promise<Provider> {
  const existing = await payload.find({
    collection: 'providers',
    where: { type: { equals: 'newsHq' } },
    limit: 1,
    overrideAccess: true,
  })
  const baseUrl = resolveNewsHqBaseUrl()
  if (existing.docs[0]) {
    if (existing.docs[0].baseUrl !== baseUrl || !existing.docs[0].enabled) {
      return payload.update({
        collection: 'providers',
        id: existing.docs[0].id,
        data: { baseUrl, enabled: true },
        overrideAccess: true,
      })
    }
    return existing.docs[0]
  }
  return payload.create({
    collection: 'providers',
    data: {
      name: 'TRT NewsHQ',
      type: 'newsHq',
      enabled: true,
      baseUrl,
      channels: [],
    },
    overrideAccess: true,
  })
}

async function loadNewsHqSearchDefaults(payload: Payload): Promise<{
  agencies: string[]
  priorities: string
  defaultLang: string
  keepLimit: number
  fetchLimit: number
}> {
  const settings = await payload.findGlobal({ slug: 'news-hq-settings', overrideAccess: true })
  const keepLimit =
    settings.limit && settings.limit > 0
      ? Math.min(settings.limit, NEWSHQ_RESULT_LIMIT)
      : NEWSHQ_RESULT_LIMIT
  return {
    agencies: settings.agencies ?? [],
    priorities: (settings.priorities?.length ? settings.priorities : ['1', '2', '3', '4']).join(','),
    defaultLang: settings.defaultLang || 'en',
    keepLimit,
    fetchLimit: NEWSHQ_FETCH_LIMIT,
  }
}

/** NewsHQ-only collection for a brief topic. Hits are stored as reviewStatus=candidate. */
export async function collectForBriefItem(
  payload: Payload,
  user: User,
  cmsClient: CmsClient,
  briefItem: BriefItem,
  brief: EditorialBrief,
): Promise<{ collectedItems: CollectedItem[]; status: BriefItem['status']; error?: string }> {
  const providerDoc = await ensureNewsHqProvider(payload)
  const defaults = await loadNewsHqSearchDefaults(payload)

  const channelConfigResult = await payload.find({
    collection: 'channel-configs',
    where: { channel: { equals: brief.channel } },
    limit: 1,
    overrideAccess: true,
  })
  const channelConfig = channelConfigResult.docs[0]

  const lang = toNewsHqLang(
    channelConfig?.erLang || channelConfig?.language,
    defaults.defaultLang,
  )

  let agencies = defaults.agencies
  if (agencies.length === 0) {
    try {
      const filters = await fetchNewsHqFilters()
      agencies = filters.providersByLanguage[lang] ?? filters.agencies
    } catch {
      agencies = []
    }
  }

  const keywordLayers = buildNewsHqKeywordLayers(briefItem, NEWSHQ_SEARCH_LAYERS)
  const rankTerms = buildNewsHqRankTerms(briefItem.topic, keywordLayers, briefItem.keywords ?? [])
  const exclusions = (briefItem.exclusions ?? []).map((e) => e.trim()).filter(Boolean)

  const providerConfig: NewsHqProviderConfig = {
    type: 'newsHq',
    id: providerDoc.id,
    name: providerDoc.name,
    baseUrl: providerDoc.baseUrl,
    agencies: agencies.length > 0 ? agencies : undefined,
  }

  // Multilayer search: query each top keyword separately (limit 50), merge + dedupe,
  // then rank locally and LLM-filter down to keepLimit.
  const layers = keywordLayers.length > 0 ? keywordLayers : [undefined]
  let items: Awaited<ReturnType<typeof fetchNewsHqProvider>> = []
  try {
    const seen = new Set<string>()
    for (const layerKeyword of layers) {
      const batch = await fetchNewsHqProvider(providerConfig, {
        channelId: brief.channel,
        language: lang,
        keywordsIncluded: layerKeyword ? [layerKeyword] : undefined,
        keywordsExcluded: exclusions.length > 0 ? exclusions : undefined,
        priority: defaults.priorities,
        dateFrom: newsHqDateFrom(2),
        limit: defaults.fetchLimit,
      })
      for (const item of batch) {
        if (seen.has(item.providerItemId)) continue
        seen.add(item.providerItemId)
        items.push(item)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'NewsHQ search failed'
    console.error(`[collectForBriefItem] ${briefItem.topic}:`, message)
    await payload.update({
      collection: 'brief-items',
      id: briefItem.id,
      data: { status: 'error', lastQueryRunAt: new Date().toISOString() },
      overrideAccess: false,
      user,
    })
    return { collectedItems: [], status: 'error', error: message }
  }

  // Keep a shortlist for the LLM (cost/latency), then ask it which truly match.
  const shortlist = filterAndRankNewsHqHits(items, briefItem.topic, rankTerms, NEWSHQ_LLM_SHORTLIST)
  let relevantIds: string[] = []
  try {
    relevantIds = await filterRelevantNewsHqHits({
      topic: briefItem.topic,
      keywords: rankTerms.slice(0, 8),
      candidates: shortlist,
    })
  } catch {
    // If the LLM check fails, fall back to the local shortlist rather than blocking collection.
    relevantIds = shortlist.map((item) => item.providerItemId)
  }

  const relevantSet = new Set(relevantIds)
  items = shortlist
    .filter((item) => relevantSet.has(item.providerItemId))
    .slice(0, defaults.keepLimit)

  const existingHits = await payload.find({
    collection: 'collected-items',
    where: { briefItem: { equals: briefItem.id } },
    limit: 200,
    overrideAccess: true,
  })
  const existingProviderIds = new Set(
    existingHits.docs.flatMap((doc) => doc.sources.map((s) => s.providerItemId)),
  )

  const collectedItems: CollectedItem[] = []
  for (const item of items) {
    if (existingProviderIds.has(item.providerItemId)) continue

    let existingCms: Awaited<ReturnType<CmsClient['searchContent']>> = []
    try {
      existingCms = await cmsClient.searchContent(item.headline, { channelId: brief.channel, limit: 1 })
    } catch {
      existingCms = []
    }
    if (existingCms.length > 0) continue

    const doc = await payload.create({
      collection: 'collected-items',
      data: {
        briefItem: briefItem.id,
        groupKey: null,
        headline: item.headline,
        body: item.body || item.headline,
        language: item.language,
        reviewStatus: 'candidate',
        sources: [
          {
            provider: item.providerId,
            providerItemId: item.providerItemId,
            sourceUrl: item.sourceUrl,
            publishTimestamp: item.publishTimestamp,
            rawPayload: item.raw as Record<string, unknown>,
          },
        ],
      },
      overrideAccess: false,
      user,
    })
    collectedItems.push(doc)
  }

  const totalForItem = existingHits.docs.length + collectedItems.length
  const status: BriefItem['status'] = totalForItem > 0 ? 'queried' : 'no-results'
  await payload.update({
    collection: 'brief-items',
    id: briefItem.id,
    data: { status, lastQueryRunAt: new Date().toISOString() },
    overrideAccess: false,
    user,
  })

  return { collectedItems, status }
}
