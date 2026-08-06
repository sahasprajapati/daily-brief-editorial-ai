export type SuggestionSeverity = 'softFail' | 'hardFail'

/** Persisted QA Docs-style note (also used as draft before verdict submit). */
export interface QaSuggestion {
  id: string
  quote: string
  message: string
  severity: SuggestionSeverity
  blockId: string
  startOffset: number
  endOffset: number
  createdAt: string
}

export type SuggestionAnchorStatus = 'exact' | 'relocated' | 'text-changed' | 'orphaned'

export interface ResolvedSuggestionAnchor {
  suggestion: QaSuggestion
  status: SuggestionAnchorStatus
  /** Inclusive start within block.text when status is exact|relocated; 0 when text-changed. */
  startOffset: number
  /** Exclusive end within block.text; block.text.length when text-changed. */
  endOffset: number
}
