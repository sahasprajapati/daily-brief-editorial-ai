import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import type { RelevanceCandidate } from './relevance-types'

const relevanceSchema = z.object({
  matches: z.array(
    z.object({
      providerItemId: z.string(),
      relevant: z.boolean(),
      reason: z.string(),
    }),
  ),
})

const SYSTEM_PROMPT = `You judge whether wire-service search hits are relevant to a brief topic.
A hit is relevant only if it is clearly about the same news story / entities as the topic
(not merely sharing a generic word like "football", "election", or "war").
Reject digests, schedules, advisories, and loosely related regional coverage.
Be strict: when unsure, mark relevant=false.`

export async function runRelevanceCheck(input: {
  topic: string
  keywords: string[]
  candidates: RelevanceCandidate[]
}): Promise<Array<{ providerItemId: string; relevant: boolean; reason: string }>> {
  const prompt = [
    `TOPIC: ${input.topic}`,
    `KEYWORDS: ${input.keywords.length ? input.keywords.join(', ') : '(none)'}`,
    '',
    'CANDIDATES:',
    ...input.candidates.map((c, i) => {
      const body = (c.body || '').replace(/\s+/g, ' ').trim().slice(0, 280)
      return `${i + 1}. id=${c.providerItemId}\nsource=${c.source}\nheadline=${c.headline}\nexcerpt=${body}`
    }),
  ].join('\n')

  const { object } = await generateObject({
    model: google('gemini-flash-lite-latest'),
    schema: relevanceSchema,
    system: SYSTEM_PROMPT,
    prompt,
  })

  return object.matches
}
