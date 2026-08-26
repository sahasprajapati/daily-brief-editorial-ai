import type { QaVerdictResult } from '@/lib/qa-verdict'

const VERDICT_LABEL: Record<QaVerdictResult['verdict'], string> = {
  goodToGo: 'Good to go',
  needsAttention: 'Needs attention',
  rejected: 'Rejected',
}

const DECIDED_BY_LABEL: Record<QaVerdictResult['decidedBy'], string> = {
  hardFailRule: 'Decided by rule (banned term match)',
  ai: 'Decided by AI, against okf-ruleset',
  unavailable: 'AI unavailable — safe default',
}

export function AiVerdictCard({ result }: { result: QaVerdictResult }) {
  return (
    <div className="card" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
      <h2>AI QA verdict</h2>
      <p className="subtitle">
        Recommendation only — pre-fills the verdict below, a human still submits it.
      </p>

      <div className="score-row" style={{ alignItems: 'center' }}>
        <span className={`verdict-badge verdict-badge-${result.verdict}`}>{VERDICT_LABEL[result.verdict]}</span>
        <span className="meta">{DECIDED_BY_LABEL[result.decidedBy]}</span>
      </div>

      <p style={{ fontSize: '0.875rem', margin: '0.75rem 0' }}>{result.reasoning}</p>

      {result.concerns.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.875rem', margin: '0.5rem 0' }}>Concerns</h3>
          <ul className="list">
            {result.concerns.map((concern, index) => (
              <li
                key={index}
                className={`banner ${concern.severity === 'hardFail' ? 'banner-error' : 'banner-warn'}`}
                style={{ marginBottom: '0.5rem' }}
              >
                {concern.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
