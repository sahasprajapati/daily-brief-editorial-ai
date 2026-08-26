import type { PieceStepperStep } from '@/lib/pieces/assignment-status'

const STEPS = [
  { id: 'edit', label: 'Edit' },
  { id: 'qa', label: 'QA' },
  { id: 'image', label: 'Cover image' },
  { id: 'manager', label: 'Send to manager' },
] as const

const ORDER: Record<PieceStepperStep, number> = {
  edit: 0,
  qa: 1,
  image: 2,
  manager: 3,
}

export function PieceStepper({
  current,
  processing = false,
}: {
  current: PieceStepperStep
  /** True while the current step's action is in flight (e.g. QA running after Submit) —
   *  shows a spinner in place of the step number instead of just sitting on "current". */
  processing?: boolean
}) {
  const currentIndex = ORDER[current]

  return (
    <ol className="brief-stepper" aria-label="Piece workflow">
      {STEPS.map((step, index) => {
        const isCurrent = index === currentIndex
        const className = [
          'brief-step',
          isCurrent ? 'is-current' : '',
          index < currentIndex ? 'is-done' : '',
          isCurrent && processing ? 'is-processing' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <li key={step.id} className={className}>
            <span className="brief-step-num">
              {isCurrent && processing ? <span className="brief-step-spinner" aria-hidden /> : index + 1}
            </span>
            <span className="brief-step-label">{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
