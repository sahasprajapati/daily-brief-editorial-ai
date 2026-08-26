'use client'

import { useRef, useState } from 'react'
import { extractBriefTextFromFile } from '@/lib/brief-extraction/browser-text'

function UploadCloudIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18a4.5 4.5 0 0 1-1-8.9 5.5 5.5 0 0 1 10.8-1.8A4.5 4.5 0 0 1 17 18H7Z" />
      <path d="M12 11v7M9.5 13.5 12 11l2.5 2.5" />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <path d="M6 2.5h8l4.5 4.5V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
      <path d="M14 2.5V7a1 1 0 0 0 1 1H19" />
    </svg>
  )
}

async function readFileAsText(file: File): Promise<string> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.pdf') || lower.endsWith('.docx')) {
    const { text } = await extractBriefTextFromFile(file)
    return text
  }
  return (await file.text()).trim()
}

/** A big, prominent upload slot for the channel's one primary/authoritative QA or writing
 *  reference document — distinct from the itemized supplementary notes in InstructionBoxList.
 *  Uploading extracts text client-side (same pipeline the brief-upload flow uses) and carries
 *  filename + extracted text as hidden inputs; the file itself is never sent to the server. */
export function MajorFileSlot({
  label,
  hint,
  fileNameField,
  fileTextField,
  initialFileName,
  initialFileText,
}: {
  label: string
  hint: string
  fileNameField: string
  fileTextField: string
  initialFileName: string
  initialFileText: string
}) {
  const [fileName, setFileName] = useState(initialFileName)
  const [fileText, setFileText] = useState(initialFileText)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    setIsUploading(true)
    try {
      const text = await readFileAsText(file)
      if (!text.trim()) throw new Error('No text found in that file.')
      setFileName(file.name)
      setFileText(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="major-file-slot">
      <input type="hidden" name={fileNameField} value={fileName} />
      <input type="hidden" name={fileTextField} value={fileText} />

      <div className="major-file-header">
        <span className="major-file-badge">Major</span>
        <span className="major-file-label">{label}</span>
      </div>
      <p className="instructions-hint">{hint}</p>

      <div
        className={`major-file-box${fileName ? ' has-file' : ''}${isDragOver ? ' is-drag-over' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragOver(false)
          const file = event.dataTransfer.files?.[0]
          if (file) void handleFile(file)
        }}
      >
        {fileName ? (
          <>
            <span className="major-file-doc-icon">
              <DocIcon />
            </span>
            <span className="major-file-doc-name">{fileName}</span>
            <div className="major-file-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Reading…' : 'Upload again'}
              </button>
              <button
                type="button"
                className="btn-secondary is-remove"
                onClick={() => {
                  setFileName('')
                  setFileText('')
                }}
              >
                Remove
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="major-file-empty"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            <span className="major-file-upload-icon">
              <UploadCloudIcon />
            </span>
            <span className="major-file-empty-title">{isUploading ? 'Reading…' : 'Click to upload, or drag a file here'}</span>
            <span className="major-file-empty-hint">.pdf, .docx, .txt, or .md</span>
          </button>
        )}
      </div>
      {error && <p className="instruction-upload-error">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="instruction-upload-input"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void handleFile(file)
        }}
      />
    </div>
  )
}
