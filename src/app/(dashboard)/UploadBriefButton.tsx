'use client'

import { useEffect, useState } from 'react'
import { UploadForm } from './briefs/new/UploadForm'
import type { Desk } from '@/lib/desks'

/** Opens the brief upload flow in a modal instead of navigating to /briefs/new — same
 *  UploadForm, same server action, just no page transition. Used by both the dashboard
 *  header button and the briefs list page so upload behaves identically everywhere. */
export function UploadBriefButton({
  channel,
  reason,
  className = 'btn-primary page-header-btn',
  label = 'Upload Brief',
}: {
  channel: Desk | null
  reason: string | null
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 10.5V2.5M8 2.5L4.5 6M8 2.5L11.5 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2.5 11v1.5A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {label}
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Upload daily brief"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Upload daily brief</h2>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {channel ? (
              <>
                <div className="channel-chip" title={channel.id}>
                  Channel · {channel.name}
                </div>
                <UploadForm channel={channel} />
              </>
            ) : (
              <div className="upload-disabled-panel card">
                <h2>Upload disabled</h2>
                <p className="subtitle" style={{ marginBottom: 0 }}>
                  {reason}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
