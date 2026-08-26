'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setSelectedChannel } from './shell-actions'
import type { Desk } from '@/lib/desks'
import { badgeColor, getChannelLogo, initials } from './channel-meta'

type Option = { id: string; name: string }

export function ChannelSwitcher({
  desks,
  selected,
  showAllOption,
}: {
  desks: Desk[]
  selected: string
  showAllOption: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const allOptions: Option[] = useMemo(
    () => (showAllOption ? [{ id: 'all', name: 'All channels' }, ...desks] : desks),
    [desks, showAllOption],
  )

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allOptions
    return allOptions.filter((option) => option.name.toLowerCase().includes(q))
  }, [allOptions, query])

  const current = allOptions.find((option) => option.id === selected)
  const currentName = current?.name ?? 'Select channel'

  function choose(id: string) {
    setOpen(false)
    setQuery('')
    startTransition(async () => {
      await setSelectedChannel(id)
      router.refresh()
    })
  }

  return (
    <div className="channel-switcher" ref={rootRef}>
      <button
        type="button"
        className="channel-switcher-trigger"
        disabled={isPending}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ChannelBadge id={selected} name={currentName} />
        <span className="channel-switcher-name">{currentName}</span>
        <svg
          className={`channel-switcher-chevron${open ? ' is-open' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="channel-switcher-panel" role="listbox">
          {desks.length > 6 && (
            <div className="channel-switcher-search">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <input
                autoFocus
                type="text"
                placeholder="Search channels…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          )}
          <div className="channel-switcher-options">
            {filteredOptions.length === 0 ? (
              <div className="channel-switcher-empty">No channels match &ldquo;{query}&rdquo;</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`channel-switcher-option${option.id === selected ? ' is-selected' : ''}`}
                  role="option"
                  aria-selected={option.id === selected}
                  onClick={() => choose(option.id)}
                >
                  <ChannelBadge id={option.id} name={option.name} />
                  <span className="channel-switcher-option-name">{option.name}</span>
                  {option.id === selected && (
                    <svg className="channel-switcher-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M3.5 8.5l3 3 6-7"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelBadge({ id, name }: { id: string; name: string }) {
  if (id === 'all') {
    return <span className="channel-switcher-badge channel-switcher-badge-all">All</span>
  }
  const logo = getChannelLogo(name)
  if (logo) {
    return (
      <span className="channel-switcher-badge channel-switcher-badge-logo">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static local SVG, not worth next/image here */}
        <img src={logo} alt="" />
      </span>
    )
  }
  return (
    <span className="channel-switcher-badge" style={{ background: badgeColor(name) }}>
      {initials(name)}
    </span>
  )
}
