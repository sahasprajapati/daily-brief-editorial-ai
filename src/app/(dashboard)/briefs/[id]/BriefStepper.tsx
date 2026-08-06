'use client'

import Link from 'next/link'

const STEPS = [
  { id: 1, label: 'Approve parse' },
  { id: 2, label: 'Sources' },
  { id: 3, label: 'Generate' },
] as const

export function BriefStepper({
  briefId,
  step,
  confirmed,
  hasSources,
}: {
  briefId: string
  step: 1 | 2 | 3
  confirmed: boolean
  hasSources: boolean
}) {
  return (
    <ol className="brief-stepper">
      {STEPS.map((s) => {
        const isLocked = (s.id === 2 && !confirmed) || (s.id === 3 && !hasSources)
        const className = [
          'brief-step',
          s.id === step ? 'is-current' : '',
          s.id < step ? 'is-done' : '',
          isLocked ? 'is-locked' : '',
        ]
          .filter(Boolean)
          .join(' ')

        if (isLocked) {
          return (
            <li key={s.id} className={className}>
              <span className="brief-step-num">{s.id}</span>
              <span className="brief-step-label">{s.label}</span>
            </li>
          )
        }

        return (
          <li key={s.id} className={className}>
            <Link
              href={`/briefs/${briefId}?tab=workflow&step=${s.id}`}
              className="brief-step-link"
            >
              <span className="brief-step-num">{s.id}</span>
              <span className="brief-step-label">{s.label}</span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
