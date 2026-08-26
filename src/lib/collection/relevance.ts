import { runRelevanceCheck } from './relevance-openai'
import type { RelevanceCandidate } from './relevance-types'

export type { RelevanceCandidate } from './relevance-types'

/** Ask the LLM which candidates match the topic/keywords; returns matching providerItemIds. */
export async function filterRelevantNewsHqHits(input: {
  topic: string
  keywords: string[]
  candidates: RelevanceCandidate[]
}): Promise<string[]> {
  if (input.candidates.length === 0) return []

  const matches = await runRelevanceCheck(input)
  const allowed = new Set(input.candidates.map((c) => c.providerItemId))
  return matches
    .filter((m) => m.relevant && allowed.has(m.providerItemId))
    .map((m) => m.providerItemId)
}
