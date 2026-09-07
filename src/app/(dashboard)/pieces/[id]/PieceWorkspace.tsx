'use client'

import { useActionState, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ContentBlock } from '@/lib/content-diff'
import { defaultCoverImagePrompt } from '@/lib/cover-image'
import { stepFromStatus, type AssignmentStatus, type PieceStepperStep } from '@/lib/pieces/assignment-status'
import type { QaVerdictResult } from '@/lib/qa-verdict'
import { generateCoverImageForPiece, markPieceAsDrafted, submitForQaReview } from './actions'
import { PieceStepper } from './PieceStepper'

/** Cover images are generated as data: URIs (see cover-image/types.ts) - recovers a reasonable
 *  filename/extension for the download link from the URI's declared mime type. */
function coverImageFileName(dataUrl: string): string {
  const subtype = /^data:image\/([a-z0-9.+-]+);base64,/i.exec(dataUrl)?.[1]?.split('+')[0] ?? 'png'
  return `cover-image.${subtype === 'jpeg' ? 'jpg' : subtype}`
}

/** No fixed height/rows — grows with content so the block reads as part of one flowing
 *  document instead of a fixed-size box. */
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

type SubmitState = { error: string | null; result: QaVerdictResult | null }
type ImageState = { error: string | null; dataUrl: string | null; prompt: string | null }
type DraftState = { error: string | null; drafted: boolean }

const initialSubmitState: SubmitState = { error: null, result: null }
const initialDraftState: DraftState = { error: null, drafted: false }

const VERDICT_LABEL: Record<QaVerdictResult['verdict'], string> = {
  goodToGo: 'Good to go',
  needsAttention: 'Needs attention',
  rejected: 'Rejected',
}

function bannerClass(verdict: QaVerdictResult['verdict']): string {
  if (verdict === 'goodToGo') return 'banner-success'
  if (verdict === 'needsAttention') return 'banner-warn'
  return 'banner-error'
}

// 'drafted' is the normal terminal state now; the manager-pipeline statuses are dormant
// leftovers (see AssignmentStatus) kept here only so an old/manually-edited piece still locks.
const SENT_STATUSES: AssignmentStatus[] = ['drafted', 'awaitingApproval', 'approved', 'published']

export function PieceWorkspace({
  pieceId,
  initialBlocks,
  initialStatus,
  latestVerdict,
  initialCoverImageUrl,
  initialCoverImagePrompt,
  extraImageInstructions,
}: {
  pieceId: string
  initialBlocks: ContentBlock[]
  initialStatus: AssignmentStatus
  /** Last verdict on record for this piece (may be from an earlier session) — restores the
   *  "good to go, generate a cover image" state after a page reload. */
  latestVerdict: QaVerdictResult['verdict'] | null
  initialCoverImageUrl: string | null
  initialCoverImagePrompt: string | null
  /** Channel-general image instructions (channel-configs.extraImageInstructions, set on the
   *  Instructions settings page) — only used to seed the default prompt for a piece that hasn't
   *  generated a cover image yet; the shape (ratio) and these instructions themselves are
   *  applied server-side on every generation regardless, see generateCoverImageForPiece. */
  extraImageInstructions: string
}) {
  const router = useRouter()
  const [blocks, setBlocks] = useState(initialBlocks)
  const [coverImageUrl, setCoverImageUrl] = useState(initialCoverImageUrl)
  const headline = blocks.find((block) => block.type === 'heading')?.text ?? ''
  const [prompt, setPrompt] = useState(
    initialCoverImagePrompt || defaultCoverImagePrompt(headline, extraImageInstructions),
  )

  const [submitState, submitAction, isSubmitting] = useActionState<SubmitState, FormData>(
    async () => {
      const outcome = await submitForQaReview(pieceId, blocks)
      if (!outcome.error) router.refresh()
      return outcome
    },
    initialSubmitState,
  )

  const [imageState, imageAction, isGeneratingImage] = useActionState<ImageState, FormData>(
    async () => {
      const outcome = await generateCoverImageForPiece(pieceId, prompt)
      if (outcome.dataUrl) setCoverImageUrl(outcome.dataUrl)
      // Reflect the composed prompt (editor's text + base style directive) back into the box —
      // it's what was actually sent and saved, not just what was typed before generating.
      if (outcome.prompt) setPrompt(outcome.prompt)
      return outcome
    },
    { error: null, dataUrl: initialCoverImageUrl, prompt: null },
  )

  const [draftState, draftAction, isDrafting] = useActionState<DraftState, FormData>(
    async () => {
      const outcome = await markPieceAsDrafted(pieceId)
      if (outcome.error) return { error: outcome.error, drafted: false }
      router.refresh()
      return { error: null, drafted: true }
    },
    initialDraftState,
  )

  // Already drafted in an earlier session (page reload after marking as drafted) — nothing left
  // for the editor to do here, so don't show an editable form that implies otherwise.
  if (SENT_STATUSES.includes(initialStatus) && !draftState.drafted && !submitState.result) {
    return (
      <div>
        <PieceStepper current="drafted" />
        <div className="card">
          <p className="subtitle" style={{ marginTop: 0, marginBottom: 0 }}>
            {initialStatus === 'drafted'
              ? 'Drafted — no further action needed here.'
              : 'Sent to the manager for approval — no further action needed here.'}
          </p>
        </div>
      </div>
    )
  }

  const result = submitState.result
  // This session's verdict takes priority; otherwise fall back to the last one on record so a
  // goodToGo state (and the cover-image step it unlocks) survives a page reload.
  const verdict = result?.verdict ?? (isSubmitting ? null : latestVerdict)
  const passedQa = verdict === 'goodToGo'
  const readyToDraft = passedQa && Boolean(coverImageUrl)
  const locked = draftState.drafted

  let displayStep: PieceStepperStep = stepFromStatus(initialStatus)
  if (isSubmitting) {
    displayStep = 'qa'
  } else if (isGeneratingImage) {
    displayStep = 'image'
  } else if (passedQa) {
    displayStep = coverImageUrl ? 'drafted' : 'image'
  } else if (result) {
    displayStep = 'edit'
  }

  return (
    <div>
      <PieceStepper current={displayStep} processing={isSubmitting || isGeneratingImage} />

      <div className="card">
        {result && (
          <div className={`banner ${bannerClass(result.verdict)}`} style={{ marginBottom: '1rem' }}>
            <strong>{VERDICT_LABEL[result.verdict]}</strong> — {result.reasoning}
            {result.concerns.length > 0 && (
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                {result.concerns.map((concern, index) => (
                  <li key={index}>{concern.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!result && passedQa && (
          <div className="banner banner-success" style={{ marginBottom: '1rem' }}>
            <strong>Good to go</strong> — generate a cover image to continue.
          </div>
        )}

        {draftState.drafted && (
          <div className="banner banner-success" style={{ marginBottom: '1rem' }}>
            Marked as drafted.
          </div>
        )}

        <div className="piece-editor">
          {blocks.map((block, index) => (
            <textarea
              key={block.blockId}
              ref={autoGrow}
              value={block.text}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                const text = event.target.value
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, text } : b)))
                autoGrow(event.target)
              }}
              rows={1}
              className={
                block.type === 'heading' ? 'piece-editor-block piece-editor-heading' : 'piece-editor-block piece-editor-paragraph'
              }
              disabled={locked}
            />
          ))}
        </div>

        {!locked && (
          <div className="form-actions" style={{ justifyContent: 'flex-start', gap: '0.75rem' }}>
            <form action={submitAction}>
              <button type="submit" className="btn-primary" disabled={isSubmitting || isDrafting}>
                {isSubmitting ? 'Running QA…' : passedQa ? 'Re-run QA' : 'Submit'}
              </button>
            </form>
          </div>
        )}

        {submitState.error && (
          <div className="banner banner-error" style={{ marginTop: '0.75rem' }}>
            {submitState.error}
          </div>
        )}

        {passedQa && !locked && (
          <div className="card" style={{ marginTop: '1.25rem', background: '#f9fafb' }}>
            <h2>Cover image</h2>
            <p className="subtitle" style={{ marginTop: 0 }}>
              Generated with OpenAI image generation — a placeholder until Atlas AI replaces it.
            </p>

            {coverImageUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not a static asset */}
                <img
                  src={coverImageUrl}
                  alt="Generated cover"
                  style={{ width: '100%', maxWidth: '24rem', borderRadius: 'var(--radius-lg)', marginBottom: '0.5rem', display: 'block' }}
                />
                <a
                  href={coverImageUrl}
                  download={coverImageFileName(coverImageUrl)}
                  className="btn-link"
                  style={{ display: 'inline-block', marginBottom: '0.75rem' }}
                >
                  Download image
                </a>
              </>
            )}

            <label htmlFor="cover-image-prompt" className="field-label">
              Prompt
            </label>
            <textarea
              id="cover-image-prompt"
              className="field-input"
              rows={2}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />

            <form action={imageAction} className="form-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className="btn-secondary" disabled={isGeneratingImage || !prompt.trim()}>
                {isGeneratingImage ? 'Generating…' : coverImageUrl ? 'Regenerate cover image' : 'Generate cover image'}
              </button>
            </form>

            {imageState.error && (
              <div className="banner banner-error" style={{ marginTop: '0.75rem' }}>
                {imageState.error}
              </div>
            )}
          </div>
        )}

        {readyToDraft && !locked && (
          <div className="form-actions" style={{ justifyContent: 'flex-start', marginTop: '1rem' }}>
            <form action={draftAction}>
              <button type="submit" className="btn-primary" disabled={isDrafting || isSubmitting || isGeneratingImage}>
                {isDrafting ? 'Marking as drafted…' : 'Mark as drafted'}
              </button>
            </form>
          </div>
        )}
        {draftState.error && (
          <div className="banner banner-error" style={{ marginTop: '0.75rem' }}>
            {draftState.error}
          </div>
        )}
      </div>
    </div>
  )
}
