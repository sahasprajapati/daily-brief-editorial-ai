import type { PreQaResult } from '@/lib/pre-qa'

export function PreQaHints({ result }: { result: PreQaResult }) {
  return (
    <div className="card" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
      <h2>Pre-QA hints</h2>
      <p className="subtitle">Advisory only — does not write a verdict. Match cms-prod review banners.</p>

      {result.flags.length > 0 && (
        <ul className="list" style={{ marginBottom: '1rem' }}>
          {result.flags.map((flag, index) => (
            <li key={index} className="banner banner-error" style={{ marginBottom: '0.5rem' }}>
              {flag.message} <span className="meta">(block {flag.blockId.slice(0, 8)})</span>
            </li>
          ))}
        </ul>
      )}

      {result.naturalnessUnavailable ? (
        <div className="banner banner-warn">Naturalness score unavailable — check GOOGLE_GENERATIVE_AI_API_KEY.</div>
      ) : (
        <div className="score-row">
          <span className="score-chip">Naturalness {result.naturalnessScore}/100</span>
          <span className="score-chip">Overall {result.overallScore}/100</span>
        </div>
      )}

      <p style={{ fontSize: '0.875rem', margin: '0.75rem 0' }}>{result.reasoning}</p>

      {result.suggestions.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.875rem', margin: '0.5rem 0' }}>Suggestions</h3>
          <ul className="list">
            {result.suggestions.map((suggestion, index) => (
              <li key={index} className="banner banner-warn" style={{ marginBottom: '0.5rem' }}>
                {suggestion}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
