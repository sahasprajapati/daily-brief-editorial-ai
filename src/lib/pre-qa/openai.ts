import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

const naturalnessSchema = z.object({
  naturalnessScore: z.number(),
  overallScore: z.number(),
  reasoning: z.string(),
  suggestions: z.array(z.string()).default([]),
})

export type NaturalnessResult = z.infer<typeof naturalnessSchema>

/** Adapted from trt-editorial-n8n/trt-daily-editorial.json's "QA Validation" agent - same
 *  AI-detection heuristics (forbidden phrases, structural red flags), advisory only: this
 *  never blocks anything, it feeds the human reviewer's own verdict. */
const SYSTEM_PROMPT = `You are a TRT editorial QA reviewer checking a generated article for natural
journalistic flow and signs of AI-generated text.

Forbidden phrases to flag if present: "Imagine...", "Picture this...", "It's not just X but also Y",
"At first glance... but look closer", "It's worth noting that...", "In conclusion...", "The takeaway
here is...", "signifies a landmark moment".

Structural red flags: every paragraph following an intro-development-conclusion pattern, overly
balanced coverage without editorial focus, academic tone instead of journalistic voice, repetitive
sentence structures throughout.

Score naturalness and overall quality 0-100 and list concrete rewrite suggestions.`

export async function runNaturalnessCheck(articleText: string): Promise<NaturalnessResult> {
  const { object } = await generateObject({
    model: openai('gpt-4.1-mini'),
    schema: naturalnessSchema,
    system: SYSTEM_PROMPT,
    prompt: articleText,
  })
  return object
}
