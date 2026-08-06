'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { uploadBrief, type UploadBriefState } from './actions'
import { extractBriefTextFromFile } from '@/lib/brief-extraction/browser-text'
import type { Desk } from '@/lib/desks'

const initialState: UploadBriefState = { error: null, duplicateOf: null }
const ACCEPT = '.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function UploadForm({ channel }: { channel: Desk }) {
  const formRef = useRef<HTMLFormElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'paste' | 'file'>('paste')
  const [duplicateChoice, setDuplicateChoice] = useState<'replace' | 'parallel' | ''>('')
  const [pasteText, setPasteText] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [sourceType, setSourceType] = useState<'paste' | 'docx' | 'pdf'>('paste')
  const [fileName, setFileName] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [state, formAction, isPending] = useActionState(uploadBrief, initialState)

  const showingDuplicate = Boolean(state.duplicateOf && !duplicateChoice)
  const briefText = mode === 'paste' ? pasteText : extractedText

  // Re-submit after Replace / Parallel with the text kept in React state.
  useEffect(() => {
    if (!duplicateChoice || !state.duplicateOf) return
    formRef.current?.requestSubmit()
  }, [duplicateChoice, state.duplicateOf])

  async function handleFile(selected: File | undefined | null) {
    setFileError(null)
    setExtractedText('')
    setFileName(null)
    if (!selected) return

    setExtracting(true)
    try {
      const { text, sourceType: detected } = await extractBriefTextFromFile(selected)
      if (!text) {
        setFileError('No text could be read from that file. Try a text-based PDF/DOCX, or paste instead.')
        return
      }
      setExtractedText(text)
      setSourceType(detected)
      setFileName(selected.name)
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div>
      {showingDuplicate && (
        <div className="banner banner-warn" style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Brief already exists</h2>
          <p className="subtitle" style={{ marginBottom: '0.75rem' }}>
            A brief was already uploaded for {channel.name} today. Your pasted text is still kept.
          </p>
          <div className="duplicate-actions">
            <button type="button" className="btn-primary" onClick={() => setDuplicateChoice('replace')}>
              Replace it
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDuplicateChoice('parallel')}
            >
              Create parallel brief
            </button>
          </div>
        </div>
      )}

      <form ref={formRef} action={formAction} hidden={showingDuplicate}>
        <input type="hidden" name="channel" value={channel.id} />
        <input type="hidden" name="channelName" value={channel.name} />
        <input type="hidden" name="sourceType" value={mode === 'paste' ? 'paste' : sourceType} />
        {duplicateChoice && <input type="hidden" name="duplicateChoice" value={duplicateChoice} />}

        <label className="field-label" htmlFor="title">
          Title (optional)
        </label>
        <input id="title" className="field-input" name="title" type="text" placeholder="Morning brief" />

        <div className="mode-tabs" role="tablist" aria-label="Brief source">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'paste'}
            className={`mode-tab${mode === 'paste' ? ' is-active' : ''}`}
            onClick={() => {
              setMode('paste')
              setFileError(null)
              setFileName(null)
              setExtractedText('')
              setSourceType('paste')
            }}
          >
            Paste text
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'file'}
            className={`mode-tab${mode === 'file' ? ' is-active' : ''}`}
            onClick={() => setMode('file')}
          >
            Upload file
          </button>
        </div>

        {mode === 'paste' ? (
          <>
            <label className="field-label" htmlFor="pasteText">
              Brief text
            </label>
            <textarea
              id="pasteText"
              className="field-input"
              name="pasteText"
              rows={12}
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder="Paste the morning editorial brief…"
            />
          </>
        ) : (
          <>
            <input type="hidden" name="pasteText" value={extractedText} />
            <div
              className={`dropzone${dragging ? ' is-dragging' : ''}${fileName && !fileError ? ' is-ready' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                event.preventDefault()
                setDragging(false)
              }}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                void handleFile(event.dataTransfer.files?.[0])
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                className="dropzone-input"
                type="file"
                accept={ACCEPT}
                onChange={(event) => void handleFile(event.target.files?.[0])}
                onClick={(event) => event.stopPropagation()}
              />
              <div className="dropzone-icon" aria-hidden>
                {extracting ? '…' : fileName ? '✓' : '↑'}
              </div>
              {extracting ? (
                <p className="dropzone-title">Extracting text…</p>
              ) : fileName && !fileError ? (
                <>
                  <p className="dropzone-title">{fileName}</p>
                  <p className="dropzone-hint">
                    {extractedText.length.toLocaleString()} characters ready — file is not stored
                  </p>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={(event) => {
                      event.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    Choose another file
                  </button>
                </>
              ) : (
                <>
                  <p className="dropzone-title">Drag and drop a .docx or .pdf</p>
                  <p className="dropzone-hint">Only extracted text is kept — the original file is not stored</p>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={(event) => {
                      event.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    Choose file
                  </button>
                </>
              )}
            </div>
          </>
        )}

        <div className="form-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={
              isPending ||
              extracting ||
              Boolean(fileError) ||
              !briefText.trim() ||
              (mode === 'file' && !extractedText)
            }
          >
            {isPending ? 'Parsing…' : extracting ? 'Extracting…' : 'Upload and parse'}
          </button>
        </div>

        {(fileError || state.error) && (
          <div className="banner banner-error" role="alert">
            {fileError ?? state.error}
          </div>
        )}
      </form>
    </div>
  )
}
