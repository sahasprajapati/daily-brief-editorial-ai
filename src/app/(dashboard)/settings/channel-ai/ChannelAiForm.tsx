'use client'

import { useActionState, useState } from 'react'
import type { ImageRatio } from '@/lib/cover-image'
import { RATIO_LABEL } from '@/lib/cover-image'
import { saveChannelAiSettings, type SaveChannelAiSettingsState } from './actions'
import { InstructionBoxList } from './InstructionBoxList'
import { MajorFileSlot } from './MajorFileSlot'

const initialState: SaveChannelAiSettingsState = { error: null, saved: false }

const RATIO_OPTIONS: ImageRatio[] = ['landscape', 'square', 'portrait']

export function ChannelAiForm({
  channelId,
  qaInstructions,
  writingInstructions,
  majorQaFileName,
  majorQaFileText,
  majorInstructionsFileName,
  majorInstructionsFileText,
  imageRatio,
  imageInstructions,
}: {
  channelId: string
  qaInstructions: string[]
  writingInstructions: string[]
  majorQaFileName: string
  majorQaFileText: string
  majorInstructionsFileName: string
  majorInstructionsFileText: string
  imageRatio: ImageRatio
  imageInstructions: string[]
}) {
  const [state, formAction, isPending] = useActionState(saveChannelAiSettings, initialState)
  const [ratio, setRatio] = useState<ImageRatio>(imageRatio)

  return (
    <form action={formAction} className="card" style={{ marginTop: '1rem' }}>
      <input type="hidden" name="channelId" value={channelId} />

      <MajorFileSlot
        key={`major-qa-${channelId}`}
        label="Major QA File"
        hint="The channel's primary QA/fact-check reference document — supplements the general okf-ruleset checks."
        fileNameField="majorQaFileName"
        fileTextField="majorQaFileText"
        initialFileName={majorQaFileName}
        initialFileText={majorQaFileText}
      />

      <MajorFileSlot
        key={`major-instructions-${channelId}`}
        label="Major Instructions File"
        hint="The channel's primary style/writing guide — supplements the general desk guideline."
        fileNameField="majorInstructionsFileName"
        fileTextField="majorInstructionsFileText"
        initialFileName={majorInstructionsFileName}
        initialFileText={majorInstructionsFileText}
      />

      <hr className="settings-divider" />

      <div className="instructions-section">
        <p className="instructions-title">Additional QA instructions</p>
        <InstructionBoxList
          key={`qa-${channelId}`}
          name="qaInstructions"
          initialItems={qaInstructions}
          addPlaceholder="e.g. Reject casualty figures sourced from a single wire agency — require two independent confirmations."
        />
      </div>

      <hr className="settings-divider" />

      <div className="instructions-section">
        <p className="instructions-title">Additional writing instructions</p>
        <InstructionBoxList
          key={`writing-${channelId}`}
          name="writingInstructions"
          initialItems={writingInstructions}
          addPlaceholder="e.g. Spell out acronyms on first reference, then use the short form for the rest of the piece."
        />
      </div>

      <hr className="settings-divider" />

      <div className="instructions-section">
        <p className="instructions-title">Cover image instructions</p>
        <p className="subtitle" style={{ marginTop: 0 }}>
          Applied to every cover image generated for this channel — not something re-picked per article.
        </p>

        <input type="hidden" name="imageRatio" value={ratio} />
        <span className="field-label">Shape</span>
        <div className="ratio-picker" role="radiogroup" aria-label="Default cover image shape">
          {RATIO_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={ratio === option}
              className={`ratio-option${ratio === option ? ' is-active' : ''}`}
              onClick={() => setRatio(option)}
            >
              {RATIO_LABEL[option]}
            </button>
          ))}
        </div>

        <InstructionBoxList
          key={`image-${channelId}`}
          name="imageInstructions"
          initialItems={imageInstructions}
          addPlaceholder="e.g. Never depict recognizable real people — use silhouettes or wide shots instead."
        />
      </div>

      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {state.error && (
        <div className="banner banner-error" style={{ marginTop: '0.75rem' }}>
          {state.error}
        </div>
      )}
      {state.saved && !state.error && (
        <div className="banner banner-success" style={{ marginTop: '0.75rem' }}>
          Saved.
        </div>
      )}
    </form>
  )
}
