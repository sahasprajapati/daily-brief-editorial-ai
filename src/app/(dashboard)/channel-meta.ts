// Visual identity helpers for the channel switcher.
//
// A handful of flagship channels have real TRT logos (sourced from Wikimedia
// Commons, public domain) checked into public/channel-logos/. Every other
// channel — the ~40 language editions without a distinct logo asset — falls
// back to a colored lettermark badge, deterministic per channel name so it
// stays stable across renders/sessions.

const LOGO_BY_PATTERN: Array<{ test: RegExp; src: string }> = [
  { test: /^world$/i, src: '/channel-logos/trt-world.svg' },
  { test: /arabi/i, src: '/channel-logos/trt-arabi.svg' },
  { test: /russian/i, src: '/channel-logos/trt-russian.svg' },
  { test: /^afrika/i, src: '/channel-logos/trt-afrika.svg' },
]

export function getChannelLogo(name: string): string | null {
  const match = LOGO_BY_PATTERN.find((entry) => entry.test.test(name))
  return match?.src ?? null
}

const BADGE_COLORS = [
  '#3b74b6', // primary blue
  '#be7825', // warn amber
  '#059669', // emerald
  '#7c3aed', // violet
  '#dc2626', // red
  '#0891b2', // cyan
  '#c026d3', // fuchsia
  '#65a30d', // lime
  '#d97706', // orange
  '#4f46e5', // indigo
]

export function badgeColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return BADGE_COLORS[hash % BADGE_COLORS.length]
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// Wire agency logos — same sourcing (Wikimedia Commons, public domain) and same
// fallback-to-lettermark approach as the channel logos above.
const AGENCY_LOGO_BY_PATTERN: Array<{ test: RegExp; src: string }> = [
  { test: /reuters/i, src: '/channel-logos/wire-reuters.svg' },
  { test: /^ap$|associated press/i, src: '/channel-logos/wire-ap.svg' },
  { test: /\bafp\b|agence france.presse/i, src: '/channel-logos/wire-afp.svg' },
  { test: /anadolu|\baa\b/i, src: '/channel-logos/wire-anadolu.svg' },
]

export function getAgencyLogo(name: string): string | null {
  const match = AGENCY_LOGO_BY_PATTERN.find((entry) => entry.test.test(name))
  return match?.src ?? null
}
