export interface DiffableBriefItem {
  topic: string
  sectionTitle?: string | null
  format?: string | null
  keywords?: string[] | null
  angle?: string | null
  priorityOrder?: number | null
  region?: string | null
  exclusions?: string[] | null
  sentiment?: string | null
  portrayalNotes?: string | null
  bannedTerms?: string[] | null
  requiredContext?: string | null
}

export interface BriefItemDiffEntry {
  topic: string
  status: 'unchanged' | 'changed' | 'added' | 'removed'
  fieldChanges: Record<string, { before: unknown; after: unknown }>
}

const COMPARED_FIELDS = [
  'sectionTitle',
  'format',
  'keywords',
  'angle',
  'priorityOrder',
  'region',
  'exclusions',
  'sentiment',
  'portrayalNotes',
  'bannedTerms',
  'requiredContext',
] as const

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
  }
  return (a ?? null) === (b ?? null)
}

/** Diffs two brief-item snapshots (e.g. the original parse vs. the lead's edited version)
 *  matched by topic - the extraction prompt already enforces topic uniqueness within one
 *  parse, so it's a stable enough key. Mirrors src/lib/content-diff's added/unchanged/changed/
 *  removed vocabulary, but this is a distinct, purpose-built function: content-diff is
 *  block-text-specific and doesn't fit these structured multi-field rows. */
export function diffBriefItems(original: DiffableBriefItem[], current: DiffableBriefItem[]): BriefItemDiffEntry[] {
  const originalByTopic = new Map(original.map((item) => [item.topic, item]))
  const currentTopics = new Set(current.map((item) => item.topic))

  const entries: BriefItemDiffEntry[] = current.map((item) => {
    const previous = originalByTopic.get(item.topic)
    if (!previous) {
      return { topic: item.topic, status: 'added', fieldChanges: {} }
    }

    const fieldChanges: BriefItemDiffEntry['fieldChanges'] = {}
    for (const field of COMPARED_FIELDS) {
      if (!valuesEqual(previous[field], item[field])) {
        fieldChanges[field] = { before: previous[field] ?? null, after: item[field] ?? null }
      }
    }

    return {
      topic: item.topic,
      status: Object.keys(fieldChanges).length > 0 ? 'changed' : 'unchanged',
      fieldChanges,
    }
  })

  const removed: BriefItemDiffEntry[] = original
    .filter((item) => !currentTopics.has(item.topic))
    .map((item) => ({ topic: item.topic, status: 'removed', fieldChanges: {} }))

  return [...entries, ...removed]
}
