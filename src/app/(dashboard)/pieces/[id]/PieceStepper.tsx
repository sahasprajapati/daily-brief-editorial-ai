import type { PieceStepperStep } from '@/lib/pieces/assignment-status'

const STEPS = [
  { id: 'edit', label: 'Edit' },
  { id: 'qa', label: 'QA' },
  { id: 'approve', label: 'Approve' },
  { id: 'publish', label: 'Publish' },
] as const

const ORDER: Record<PieceStepperStep, number> = {
  edit: 0,
  qa: 1,
  approve: 2,
  publish: 3,
}

export function PieceStepper({ current }: { current: PieceStepperStep }) {
  const currentIndex = ORDER[current]

  return (
    <ol className="brief-stepper" aria-label="Piece workflow">
      {STEPS.map((step, index) => {
        const className = [
          'brief-step',
          index === currentIndex ? 'is-current' : '',
          index < currentIndex ? 'is-done' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <li key={step.id} className={className}>
            <span className="brief-step-num">{index + 1}</span>
            <span className="brief-step-label">{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
