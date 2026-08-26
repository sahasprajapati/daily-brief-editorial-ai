import type { ContentBlock } from '@/lib/content-diff'
import { checkNoBannedTerms, type PreQaFlag } from './no-banned-terms'
import { runNaturalnessCheck } from './openai'

export interface PreQaResult {
  flags: PreQaFlag[]
  naturalnessScore: number
  overallScore: number
  reasoning: string
  suggestions: string[]
  /** True when the LLM naturalness check failed (missing key, network, etc.) — banned-term
   *  flags still run. Matches the plan's resilient-failure rendering constraint. */
  naturalnessUnavailable?: boolean
}

/** Computed fresh on every review-page load, never persisted or written as a qa-verdicts row -
 *  see the design spec's "Pre-QA (hint layer, not a verdict)" section for why. */
export async function runPreQaChecks(blocks: ContentBlock[], bannedTerms: string[]): Promise<PreQaResult> {
  const flags = checkNoBannedTerms(blocks, bannedTerms)
  const articleText = blocks.map((block) => block.text).join('\n\n')

  try {
    const naturalness = await runNaturalnessCheck(articleText)
    return { flags, ...naturalness }
  } catch {
    return {
      flags,
      naturalnessScore: 0,
      overallScore: 0,
      reasoning: 'Naturalness check unavailable (LLM not configured or request failed). Banned-term flags above still apply.',
      suggestions: [],
      naturalnessUnavailable: true,
    }
  }
}

export type { PreQaFlag } from './no-banned-terms'
