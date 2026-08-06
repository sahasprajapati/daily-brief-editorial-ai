import type { ContentBlock } from '@/lib/content-diff'
import type { QaSuggestion, ResolvedSuggestionAnchor } from './types'

/** Resolve where each QA suggestion should highlight in the current body. */
export function resolveSuggestionAnchors(
  blocks: ContentBlock[],
  suggestions: QaSuggestion[],
): ResolvedSuggestionAnchor[] {
  const byId = new Map(blocks.map((block) => [block.blockId, block]))

  return suggestions.map((suggestion) => {
    const block = byId.get(suggestion.blockId)
    if (!block) {
      return {
        suggestion,
        status: 'orphaned',
        startOffset: 0,
        endOffset: 0,
      }
    }

    const { text } = block
    const { startOffset, endOffset, quote } = suggestion

    if (
      startOffset >= 0 &&
      endOffset > startOffset &&
      endOffset <= text.length &&
      text.slice(startOffset, endOffset) === quote
    ) {
      return { suggestion, status: 'exact', startOffset, endOffset }
    }

    const relocatedAt = text.indexOf(quote)
    if (quote.length > 0 && relocatedAt >= 0) {
      return {
        suggestion,
        status: 'relocated',
        startOffset: relocatedAt,
        endOffset: relocatedAt + quote.length,
      }
    }

    return {
      suggestion,
      status: 'text-changed',
      startOffset: 0,
      endOffset: text.length,
    }
  })
}
