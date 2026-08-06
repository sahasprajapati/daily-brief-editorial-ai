# Design: Docs-style QA suggestions on pieces

**Date:** 2026-08-10  
**Status:** Approved — implementing  
**Decisions locked:** Structured QA notes (B); stale highlights stay pinned to block with “text changed” warning (A).

## Problem

Editors need actionable QA feedback after a verdict of **Needs attention** / **Rejected**. Today:

- Pre-QA hints are ephemeral and not saved on the verdict.
- Verdict submit stores only the enum + body snapshot — no suggestion notes.
- cms-prod “diffchecker” is Audit Trail `HtmlDiff` (version compare), not editorial notes.

Editors should not think in `blockId`s. QA should read the **whole article**, **highlight a span**, and **add a suggestion** (Google Docs–like comments).

## Goals

1. QA annotates the live article with highlight → note (Docs UX).
2. Notes persist on the `qa-verdicts` row when QA submits.
3. Editors see highlights + a notes sidebar after QA.
4. If the quoted text no longer matches, keep the note on the original block and show **“Text changed”**.

## Non-goals

- Rebuilding cms-prod Audit Trail / restore-version.
- Auto-promoting Pre-QA hints into editor notes (Pre-QA stays advisory during QA review).
- Real-time collaborative commenting (single QA pass → editor read).

## Data model

Extend `qa-verdicts` with `suggestions` (array), separate from existing `flags` (rule-engine hard/soft fails):

| Field | Type | Purpose |
|-------|------|---------|
| `quote` | text | Exact selected text at annotation time |
| `message` | textarea | QA suggestion / note |
| `severity` | `softFail` \| `hardFail` | Default `softFail` |
| `blockId` | text | Anchor block (hidden from QA UI) |
| `startOffset` | number | UTF-16 offset within block text at annotation time |
| `endOffset` | number | Exclusive end offset |
| `createdAt` | date | When the note was added (client or server) |

Existing `flags` remain for automated/ruleset hits. Manual Docs notes use `suggestions`.

`submitVerdict` gains: `suggestions[]` (+ optional free-text `qaNote` later if needed). Snapshot of `currentBody` at submit stays as today.

## UX

### QA mode (piece page, assignee/role that can verdict)

1. Article rendered as continuous prose (heading + paragraphs), selectable.
2. On mouseup with a non-empty selection inside one block: popover **Add suggestion** (message + severity).
3. Notes list in a right margin/sidebar; clicking a note scrolls/highlights the span.
4. Pre-QA card remains above as advisory.
5. Verdict form: submit includes pending suggestions. Empty suggestions allowed for `goodToGo`; warn if `needsAttention`/`rejected` with zero notes (soft warn, not hard block).

Selection constrained to a **single block** for v1 (no cross-paragraph highlights). If selection spans blocks, show “Select text within one paragraph.”

### Editor mode (after latest verdict is `needsAttention` or `rejected`)

1. Same continuous article view.
2. Highlights for each suggestion:
   - Quote still found in `blockId` text (exact or via offsets if still valid) → highlight.
   - Else → highlight whole block (or first line) + badge **Text changed**.
3. Sidebar lists notes (quote excerpt + message + severity).
4. Editor can still edit via existing save flow; highlights re-resolve on load.

### Diff toggle

Keep existing “View changes” (generatedSnapshot vs currentBody HtmlDiff) as a separate mode — not the suggestion UI.

## Resolution algorithm (editor view)

For each suggestion against `currentBody`:

1. Find block by `blockId`. If missing → note is **orphaned** (show in sidebar only, “Block removed”).
2. If `block.text.slice(startOffset, endOffset) === quote` → precise highlight.
3. Else if `block.text.includes(quote)` → highlight first match; treat as OK (editor didn’t change that span).
4. Else → **Text changed**: mark severity visual + highlight entire block softly; keep note visible.

## Components (implementation sketch)

| Piece | Role |
|-------|------|
| `ArticleDocument` | Renders blocks as article; selection → callback with blockId + offsets + quote |
| `SuggestionComposer` | Popover for message/severity |
| `SuggestionSidebar` | List notes; focus highlight |
| `resolveSuggestionAnchors(blocks, suggestions)` | Pure helper for highlight ranges + status |
| `VerdictForm` | Accepts suggestions state; passes to `submitVerdict` |
| Piece `page.tsx` | Load latest verdict; pass suggestions into editor view |

## Access

- Creating suggestions: only with verdict create (same as today — assignee QA).
- Reading suggestions: anyone who can read the piece (editors see notes after QA).

## Out of scope for v1

- Generate all / multi-QA threads / resolve/unresolve threads  
- Cross-block selections  
- Inline suggested replacement text apply-button  

## Success criteria

- QA can highlight a phrase and attach a note without seeing block IDs.
- After **Needs attention**, editor opens the piece and sees that highlight + note.
- If editor rewrote the sentence, note remains on the block with **Text changed**.
