export type QaVerdictValue = 'goodToGo' | 'needsAttention' | 'rejected'

export interface QaVerdictConcern {
  severity: 'hardFail' | 'softFail'
  message: string
}

export interface QaVerdictResult {
  verdict: QaVerdictValue
  reasoning: string
  concerns: QaVerdictConcern[]
  /** How this verdict was reached — surfaced in the UI so an editor can tell a deterministic
   *  hard-fail rejection apart from an AI judgment call, or a failure that defaulted safe. */
  decidedBy: 'hardFailRule' | 'ai' | 'unavailable'
}
