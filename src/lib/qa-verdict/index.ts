import type { ContentBlock } from '@/lib/content-diff'
import { checkNoBannedTerms } from '@/lib/pre-qa/no-banned-terms'
import { getAllChecksText, getGuidelineText } from '@/lib/okf-ruleset'
import { runQaVerdictAi } from './openai'
import type { QaVerdictResult } from './types'

export type { QaVerdictConcern, QaVerdictResult, QaVerdictValue } from './types'

/** The AI verdict, from upload to this page load: deterministic hard-fail checks run first
 *  and are non-negotiable (okf-ruleset/precedence.md — "OKF hard-fail checks always win"); only
 *  when none trip does the LLM get a say, judged against the OKF checks bundle + desk guideline
 *  + this story's own angle/sentiment/portrayal guidance. Advisory — a human still submits the
 *  verdict via VerdictForm; this only pre-fills its recommendation. */
export async function runQaVerdictCheck(input: {
  blocks: ContentBlock[]
  bannedTerms: string[]
  angle: string
  sentiment: string
  portrayalNotes: string
  requiredContext: string
  guidelineSlug: string | null | undefined
  extraQaInstructions?: string | null
}): Promise<QaVerdictResult> {
  const hardFailFlags = checkNoBannedTerms(input.blocks, input.bannedTerms)
  if (hardFailFlags.length > 0) {
    return {
      verdict: 'rejected',
      reasoning: `Contains ${hardFailFlags.length} banned term${hardFailFlags.length === 1 ? '' : 's'} — automatically rejected per okf-ruleset/precedence.md (hard-fail checks always win, no AI judgment call needed).`,
      concerns: hardFailFlags.map((flag) => ({ severity: 'hardFail' as const, message: flag.message })),
      decidedBy: 'hardFailRule',
    }
  }

  const articleText = input.blocks.map((block) => block.text).join('\n\n')

  try {
    const [checksText, guidelineText] = await Promise.all([
      getAllChecksText(),
      getGuidelineText(input.guidelineSlug),
    ])
    const ai = await runQaVerdictAi({
      articleText,
      checksText,
      guidelineText,
      extraQaInstructions: input.extraQaInstructions,
      briefGuidance: {
        angle: input.angle,
        sentiment: input.sentiment,
        portrayalNotes: input.portrayalNotes,
        requiredContext: input.requiredContext,
        bannedTerms: input.bannedTerms,
      },
    })
    return { ...ai, decidedBy: 'ai' }
  } catch {
    return {
      verdict: 'needsAttention',
      reasoning: 'AI QA verdict failed to run — defaulting to "needs attention" for manual review.',
      concerns: [],
      decidedBy: 'unavailable',
    }
  }
}
