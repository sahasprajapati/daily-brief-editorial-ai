/** Hand-rolled 18x18 stroke icons (feather/lucide-style) so the sidebar doesn't need an icon
 *  library for four glyphs. Inherit color via currentColor - styled by .sidebar-link in CSS. */
const common = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function DashboardIcon() {
  return (
    <svg {...common} aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}

export function BriefsIcon() {
  return (
    <svg {...common} aria-hidden="true">
      <path d="M6 2.5h9l4.5 4.5V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
      <path d="M14.5 2.5V7a1 1 0 0 0 1 1H20" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  )
}

export function NewsHqIcon() {
  return (
    <svg {...common} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 4v5" />
      <path d="M7 13h4v4H7z" />
      <path d="M14 13h3M14 17h3" />
    </svg>
  )
}

export function ChannelAiIcon() {
  return (
    <svg {...common} aria-hidden="true">
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 3v2.5M12 18.5V21M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M3 12h2.5M18.5 12H21M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  )
}
