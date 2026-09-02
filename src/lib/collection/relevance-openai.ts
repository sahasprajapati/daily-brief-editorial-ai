import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
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
A hit is relevant if it is about the same news story / entities as the topic, or provides
direct background, context, or follow-up coverage of it - not merely sharing a generic word
like "football", "election", or "war" with no real connection to the story.
Reject digests, schedules, advisories, and coverage of a different story in the same region.
The editor reviews every hit you mark relevant and can reject it in one click, but a hit you
mark not relevant is discarded and the editor never sees it - so when a hit is a plausible,
on-topic match, mark it relevant rather than guessing it away.`

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
    model: openai('gpt-4.1-mini'),
    schema: relevanceSchema,
    system: SYSTEM_PROMPT,
    prompt,
  })

  return object.matches
}
