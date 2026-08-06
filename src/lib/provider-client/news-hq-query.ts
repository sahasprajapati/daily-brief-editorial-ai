import type { BriefItem } from '@/payload-types'
import type { NormalizedProviderItem } from './types'

const JUNK_TITLE =
  /\b(news\s+digest|news\s+schedule|news\s+advisory|news\s+agenda|7-day\s+news|advisory|morning\s+briefing|evening\s+briefing)\b/i

const GENERIC_WORD =
  /^(football|soccer|world|cup|news|video|feature|oped|op-ed|war|zone|economy|international|protests?|election|soldier|military|forces|troops|army|navy|soldiers)$/i

const STOP_RANK_WORD =
  /^(the|a|an|and|or|for|to|of|in|on|at|by|from|with|after|before|under|over|into|onto|their|its|his|her|this|that|these|those|than|then|also|just|only|about|against|between|through|during|without|within|across|around|among)$/i

/** Country/org + generic force — too broad for NewsHQ (e.g. "US forces"). */
const BROAD_FORCE_PHRASE =
  /^(us|u\.s\.|u\.s|uk|u\.k\.|un|eu|nato)\s+(forces|troops|military|soldiers|army|navy|marines)$/i

function isGenericTerm(term: string): boolean {
  const parts = term
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}-]/gu, ''))
    .filter(Boolean)
  if (parts.length === 0) return true
  return parts.every((p) => GENERIC_WORD.test(p))
}

/** Higher = better NewsHQ keywordsInclude value. */
export function scoreNewsHqKeyword(keyword: string): number {
  const k = keyword.trim()
  if (!k) return -100
  if (BROAD_FORCE_PHRASE.test(k)) return -50
  if (isGenericTerm(k)) return -40

  const words = k.split(/\s+/).filter(Boolean)
  let score = 0

  // Specific multi-word phrases beat lone broad countries for story match
  // (e.g. "commercial vessels", "naval blockade").
  if (words.length >= 2) score += 8
  if (words.length === 1 && /^\p{Lu}/u.test(k)) score += 5

  if (/\b(blockade|vessels?|ceasefire|embargo|hormuz|sanctions|hostage|refugees?|redirect(?:ed|ing)?)\b/i.test(k)) {
    score += 12
  }

  score += Math.min(k.length, 28) / 8
  return score
}

/** Prefer short, high-signal terms; NewsHQ keywordsInclude is noisy with long lists. */
export function buildNewsHqKeywordLayers(
  briefItem: Pick<BriefItem, 'topic' | 'keywords'>,
  maxLayers = 3,
): string[] {
  const topic = (briefItem.topic ?? '').trim()
  const fromBrief = (briefItem.keywords ?? [])
    .map((k) => k.trim())
    .filter(Boolean)
    .filter((k) => k.split(/\s+/).length <= 4)
    .filter((k) => !isGenericTerm(k))

  // Prefer keywords that appear in the topic (stronger match to the story).
  const inTopic = fromBrief.filter((k) => topic.toLowerCase().includes(k.toLowerCase()))
  const pool = inTopic.length > 0 ? inTopic : fromBrief

  if (pool.length > 0) {
    const ranked = [...pool]
      .sort((a, b) => scoreNewsHqKeyword(b) - scoreNewsHqKeyword(a))
      .filter((k) => scoreNewsHqKeyword(k) > 0)
    return dedupe(ranked.slice(0, maxLayers))
  }

  const entities = extractEntities(topic)
    .filter((k) => !isGenericTerm(k))
    .filter((k) => scoreNewsHqKeyword(k) > 0)
    .sort((a, b) => scoreNewsHqKeyword(b) - scoreNewsHqKeyword(a))
  if (entities.length > 0) return dedupe(entities.slice(0, maxLayers))

  // Last resort: best distinctive content word / bigram from the topic.
  const topicTerms = [
    ...extractEntities(topic),
    ...topic
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ''))
      .filter((w) => w.length > 3)
      .filter((w) => !isGenericTerm(w))
      .filter((w) => !STOP_RANK_WORD.test(w)),
  ]
  const rankedTopic = dedupe(topicTerms)
    .filter((k) => scoreNewsHqKeyword(k) > 0)
    .sort((a, b) => scoreNewsHqKeyword(b) - scoreNewsHqKeyword(a))
  return rankedTopic.slice(0, maxLayers)
}

/** Single best keyword for callers that only need one URL filter. */
export function buildNewsHqKeywords(briefItem: Pick<BriefItem, 'topic' | 'keywords'>): string[] {
  return buildNewsHqKeywordLayers(briefItem, 1)
}

/** Broader terms used only for local relevance ranking (not sent as URL keywords). */
export function buildNewsHqRankTerms(
  topic: string,
  apiKeywords: string[],
  briefKeywords: string[] = [],
): string[] {
  return dedupe([
    ...apiKeywords,
    ...briefKeywords.map((k) => k.trim()).filter(Boolean),
    ...topic
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ''))
      .filter((w) => w.length > 3)
      .filter((w) => !STOP_RANK_WORD.test(w)),
  ])
}

function extractEntities(topic: string): string[] {
  const words = topic.match(/\b[A-Z][\p{L}\p{N}'’-]+/gu) ?? []
  return dedupe(
    words.filter((m) => !/^(The|A|An|And|Or|For|To|Of|In|On|At|By|From|With|After|Before|Under)$/i.test(m)),
  )
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

export function newsHqDateFrom(daysBack = 2, now = new Date()): string {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - daysBack)
  return d.toISOString().split('T')[0]
}

export function isJunkNewsHqTitle(title: string): boolean {
  return JUNK_TITLE.test(title) || !title.trim()
}

/** Score how well a hit matches the topic / search keywords (title weighted higher). */
export function scoreNewsHqHit(
  item: Pick<NormalizedProviderItem, 'headline' | 'body'>,
  topic: string,
  keywords: string[],
): number {
  const title = item.headline.toLowerCase()
  const body = (item.body ?? '').toLowerCase().slice(0, 800)
  const terms = dedupe([
    ...keywords.map((k) => k.toLowerCase()),
    ...topic
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ''))
      .filter((w) => w.length > 3)
      .filter((w) => !STOP_RANK_WORD.test(w)),
  ])

  let score = 0
  for (const term of terms) {
    if (!term) continue
    if (title.includes(term)) score += 4
    if (body.includes(term)) score += 1
  }
  return score
}

export function filterAndRankNewsHqHits(
  items: NormalizedProviderItem[],
  topic: string,
  keywords: string[],
  limit: number,
): NormalizedProviderItem[] {
  const ranked = items
    .filter((item) => !isJunkNewsHqTitle(item.headline))
    .map((item) => ({ item, score: scoreNewsHqHit(item, topic, keywords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  // Prefer hits that match at least one API-style entity in the title when available.
  const entityTerms = keywords.filter((k) => !isGenericTerm(k) && k.length > 3)
  const withEntityInTitle =
    entityTerms.length === 0
      ? ranked
      : ranked.filter(({ item }) =>
          entityTerms.some((term) => item.headline.toLowerCase().includes(term.toLowerCase())),
        )

  const chosen = (withEntityInTitle.length > 0 ? withEntityInTitle : ranked).slice(0, limit)
  return chosen.map(({ item }) => item)
}
