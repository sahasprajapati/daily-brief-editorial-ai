import HtmlDiff from 'htmldiff-js'
import type { BlockDiffEntry, ContentBlock } from './types'

/** Diffs two block-array snapshots (e.g. the generated version vs. the editor's current
 *  version, or verdict #1's snapshot vs. verdict #3's snapshot). Blocks are matched by
 *  blockId first (cheap, exact); word-level highlighting within a changed block comes from
 *  htmldiff-js, the same diff engine trt-global-cms-prod's content-diff.tsx already uses. */
export function diffBlockSnapshots(before: ContentBlock[], after: ContentBlock[]): BlockDiffEntry[] {
  const beforeById = new Map(before.map((block) => [block.blockId, block]))
  const afterIds = new Set(after.map((block) => block.blockId))

  const entries: BlockDiffEntry[] = after.map((block) => {
    const previous = beforeById.get(block.blockId)

    if (!previous) {
      return { blockId: block.blockId, status: 'added', type: block.type, text: block.text }
    }
    if (previous.text === block.text) {
      return { blockId: block.blockId, status: 'unchanged', type: block.type, text: block.text }
    }
    return {
      blockId: block.blockId,
      status: 'changed',
      type: block.type,
      text: block.text,
      diffHtml: HtmlDiff.execute(previous.text, block.text),
    }
  })

  // ponytail: removed blocks are appended in their original relative order rather than
  // interleaved back into their original position in the sequence - fine for "what changed"
  // review; revisit with a proper LCS-based reorder if reviewers need removed blocks shown
  // in place among the surviving ones.
  const removed: BlockDiffEntry[] = before
    .filter((block) => !afterIds.has(block.blockId))
    .map((block) => ({ blockId: block.blockId, status: 'removed', type: block.type, text: block.text }))

  return [...entries, ...removed]
}
