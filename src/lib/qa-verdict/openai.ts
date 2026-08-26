import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { isOpenAiStub } from '@/lib/openai-stub'
import type { QaVerdictConcern, QaVerdictValue } from './types'

const verdictSchema = z.object({
  verdict: z.enum(['goodToGo', 'needsAttention', 'rejected']),
  reasoning: z.string(),
  concerns: z
    .array(
      z.object({
        severity: z.enum(['hardFail', 'softFail']),
        message: z.string(),
      }),
    )
    .default([]),
})

/** Mirrors okf-ruleset/precedence.md: hard-fail checks are non-negotiable, soft-fails are
 *  advisory. This only ever runs after the deterministic hard-fail checks already passed
 *  (see ../index.ts), so a hardFail concern here means the model itself found a genuine
 *  issue outside what the coded checks catch — still gates the verdict, per precedence. */
const SYSTEM_PROMPT = `You are a TRT editorial QA reviewer issuing a verdict on a generated article,
judged strictly against the OKF ruleset checks and the desk's guideline provided below.

Verdict options:
- "goodToGo": no meaningful issues — ready to publish as-is.
- "needsAttention": at least one soft-fail issue (tone, portrayal, missing required context,
  desk-guideline mismatch) an editor should look at, but nothing that blocks publishing outright.
- "rejected": at least one hard-fail issue per the checks below — non-negotiable.

Be conservative: if you're unsure whether something is hard-fail or soft-fail, treat it as
soft-fail and choose "needsAttention" rather than "rejected". Never invent issues that aren't
actually present in the article text. Every concern you list must cite something concrete from
the article, not a generic risk.`

export async function runQaVerdictAi(input: {
  articleText: string
  checksText: string
  guidelineText: string | null
  /** Channel-specific additions to the general checks (see channel-configs) - supplements
   *  checksText, doesn't replace it. */
  extraQaInstructions?: string | null
  briefGuidance: {
    angle: string
    sentiment: string
    portrayalNotes: string
    requiredContext: string
    bannedTerms: string[]
  }
}): Promise<{ verdict: QaVerdictValue; reasoning: string; concerns: QaVerdictConcern[] }> {
  if (isOpenAiStub()) {
    return stubVerdict()
  }

  const prompt = [
    'OKF QA CHECKS (this bundle is the QA criteria — judge against it, not general instinct):',
    input.checksText || '(no checks authored yet)',
    ...(input.extraQaInstructions
      ? ['', 'CHANNEL-SPECIFIC QA ADDITIONS (supplements the checks above, does not override them):', input.extraQaInstructions]
      : []),
    '',
    'DESK GUIDELINE:',
    input.guidelineText ?? 'None provided.',
    '',
    'STORY-SPECIFIC GUIDANCE (from the brief item):',
    `Angle: ${input.briefGuidance.angle || 'none specified'}`,
    `Sentiment: ${input.briefGuidance.sentiment || 'none specified'}`,
    `Portrayal notes: ${input.briefGuidance.portrayalNotes || 'none specified'}`,
    `Required context: ${input.briefGuidance.requiredContext || 'none specified'}`,
    `Banned terms (already hard-checked separately, do not re-flag): ${input.briefGuidance.bannedTerms.join(', ') || 'none'}`,
    '',
    'ARTICLE TEXT:',
    input.articleText,
  ].join('\n')

  const { object } = await generateObject({
    model: openai('gpt-4.1-mini'),
    schema: verdictSchema,
    system: SYSTEM_PROMPT,
    prompt,
  })
  return object
}

function stubVerdict(): { verdict: QaVerdictValue; reasoning: string; concerns: QaVerdictConcern[] } {
  return {
    verdict: 'needsAttention',
    reasoning:
      'AI QA verdict unavailable (OPENAI_API_KEY not configured) — defaulting to "needs attention" so a human reviews this piece manually rather than auto-approving it.',
    concerns: [],
  }
}
