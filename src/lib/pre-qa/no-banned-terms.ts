import type { ContentBlock } from '@/lib/content-diff'

export interface PreQaFlag {
  blockId: string
  rule: string
  severity: 'hardFail' | 'softFail'
  message: string
}

/** Implements okf-ruleset/checks/no-banned-terms.md: fails the piece if it contains any term
 *  listed in the matching brief item's bannedTerms. */
export function checkNoBannedTerms(blocks: ContentBlock[], bannedTerms: string[]): PreQaFlag[] {
  const flags: PreQaFlag[] = []
  for (const block of blocks) {
    const lowerText = block.text.toLowerCase()
    for (const term of bannedTerms) {
      if (term && lowerText.includes(term.toLowerCase())) {
        flags.push({
          blockId: block.blockId,
          rule: 'no-banned-terms',
          severity: 'hardFail',
          message: `"${term}" is a banned term for this story`,
        })
      }
    }
  }
  return flags
}
