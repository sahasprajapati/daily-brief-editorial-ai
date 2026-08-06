# Daily brief upload, parse, and confirm

## Problem

The lead uploads the daily editorial brief after the morning meeting; the system must parse it
into structured search intent (topics, angle, priority, region, exclusions per topic) and the
lead must explicitly confirm the parse before anything downstream (provider collection) can run.
The gate is not skippable — a bad parse produces wrong collection, wrong generation, and wasted
editor time across the whole desk.

This also folds in three gaps found while designing the flow: `trt-newsroom-ai` has no per-desk
permission concept yet (needed to know who's allowed to upload for which desk), and the shared
dashboard shell has no channel switcher, sidebar, or logout control.

## Scope

In scope:
- Per-desk "lead" permission on `Users` (`leadOfDesks`), following this codebase's existing rule
  that channel/desk identity is never a local relationship — it's owned by `trt-global-cms-prod`.
- `/briefs/new`: upload screen (paste text, or upload `.docx`/`.pdf`), gated so a non-lead-of-any-
  desk sees a disabled control, never a post-submit 403.
- LLM-based structured extraction (Gemini via the already-installed `ai` SDK), reusing the proven
  schema/prompt from the `trt-editorial-n8n` prototype (`news_items` + `coverage_policies`,
  matched by `topic`), extended to also infer `priorityOrder`, `region`, `exclusions`.
- Zero-topic parse → explicit error, nothing persisted.
- `/briefs/[id]`: review/confirm screen — every field editable, topics/exclusions/priority-order
  addable/removable/reorderable, a diff view against the original parse.
- Confirm gate enforced at the data layer (a `beforeChange` hook), not just the UI.
- Duplicate-brief-same-day handling (replace/parallel) and re-edit-after-confirm (new version),
  sharing the same "supersede" mechanics.
- Dashboard shell: sidebar (Dashboard / Briefs / admin-only "Open admin panel"), header channel
  switcher + logout.

Out of scope:
- Actually triggering provider collection (`collectFromProviders()` already exists in
  `src/lib/provider-client` but nothing calls it yet, and wiring that trigger is a separate
  feature). This spec only guarantees the gate blocks it once something does.
- A local `channels` cache/collection — desk data is always fetched live via
  `cms-client.listChannels()`, per the existing "never a local relationship" rule.
- Per-desk scoping for editors/admins (only leads are desk-scoped; editors/admins keep seeing
  everything, with an "All channels" option in the switcher).

## Data model changes

### `Users`
Add one field:
```ts
{ name: 'leadOfDesks', type: 'text', hasMany: true, admin: { description: 'External cms-prod channel ids this user leads. Empty = leads nothing.' } }
```

### New collection: `brief-files`
An `upload`-type collection, local disk storage, `mimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']`. Stores the original uploaded file for audit. Access: `create` requires desk-lead (same check as `editorial-briefs.create`); `read`/`delete` admin-only beyond the uploader's own desk.

### `editorial-briefs` — add three fields
```ts
{ name: 'sourceType', type: 'select', required: true, options: ['paste', 'docx', 'pdf'] },
{ name: 'sourceFile', type: 'relationship', relationTo: 'brief-files', admin: { description: 'Null when sourceType is paste.' } },
{ name: 'rawText', type: 'textarea', required: true, admin: { description: 'The exact text that was parsed - pasted directly, or extracted from sourceFile.' } },
```
No changes to `status` (`draft`/`parsed`/`confirmed`/`superseded` already fit — `draft` stays
unused by this flow since nothing is persisted until parsing succeeds), `version`,
`previousVersion`, `rawParseSnapshot`, `confirmedBy`, `confirmedAt` — all already present and
already shaped correctly for this feature.

### `brief-items` — no schema changes
Already has `topic`, `keywords`, `angle`, `priorityOrder`, `region`, `exclusions`, `sentiment`,
`portrayalNotes`, `bannedTerms`, `requiredContext`, `status` (`pending`/`queried`/`no-results`/
`error`) — the extraction target schema maps onto it directly.

## Access control

New helper in `src/payload/access/admin.ts`:
```ts
const isLeadOfDesk = (user: User | null, channelId: unknown): boolean =>
  typeof channelId === 'string' && (user?.leadOfDesks ?? []).includes(channelId)
```
- `editorial-briefs.create`: admin OR `isLeadOfDesk(user, data.channel)`.
- `editorial-briefs.update`: admin OR `isLeadOfDesk(user, existing-doc's channel)` (looked up via
  `findByID` with `depth: 0`, `overrideAccess: true` — same pattern as `ownAssignmentUpdate`,
  including the same depth pitfall to avoid).
- `brief-items.create`/`update`: admin OR `isLeadOfDesk(user, parent brief's channel)` (looked up
  via the `brief` relationship, `depth: 0`).
- `brief-files.create`: admin OR `isLeadOfDesk(user, <channel passed in the upload request>)`.

**Upload-screen gating (defense in depth, criterion 1):** the desk dropdown lists
`cms-client.listChannels()` intersected with `user.leadOfDesks` (admins see the full live list).
If that intersection is empty, the entire upload control (file input, paste textarea, submit)
renders `disabled` with an explanatory message — the UI must not let a non-lead attempt a
submission that then fails; access control above is the server-side backstop, not the primary
gate.

## Parse flow

1. Lead opens `/briefs/new`, already on their currently-switched channel (see Channel Switcher)
   pre-selected if they lead it, otherwise the desk dropdown defaults to their first led desk.
2. They either paste text or upload a `.docx`/`.pdf`.
3. Server action `uploadBrief`:
   a. Re-check `isLeadOfDesk` server-side (defense in depth).
   b. Extract raw text: paste is used as-is; `.docx` via `mammoth`; `.pdf` via a pdf-text-extraction
      library (new dependency — pick one that works in the Next.js Node runtime, e.g. `unpdf`).
   c. Query for an existing `editorial-briefs` doc for this `channel` with `status` not
      `superseded` and `createdAt` within today (server's local day). If found, return a
      "duplicate" response *before* calling the LLM — the client then shows a replace/parallel
      choice and re-submits with that choice attached, avoiding a wasted LLM call if the lead
      cancels.
   d. Call Gemini (`generateObject`, zod schema mirroring `news_items`/`coverage_policies` plus
      `priorityOrder`/`region`/`exclusions`, system prompt adapted from
      `trt-editorial-n8n/trt-daily-editorial.json`'s "Extract Brief" node: *"You are extracting
      structured data from a TRT newsroom morning editorial brief. Each news_item.topic must
      exactly match a coverage_policies.topic."*, extended to also ask for priority order,
      region, and exclusions per topic).
   e. Zero topics extracted → return `{ error: 'No topics found in this brief.' }`. Nothing is
      written — no `editorial-briefs` doc, no `brief-files` upload record persisted beyond the
      transient parse attempt.
   f. On success: if replacing, mark the old brief `status: 'superseded'`; create the new
      `editorial-briefs` (`status: 'parsed'`, `rawParseSnapshot` = the raw Gemini output,
      `sourceType`, `sourceFile`, `rawText`, `version` = old version + 1 if replacing else 1,
      `previousVersion` = old doc's id if replacing). Create one `brief-items` row per topic
      (`status: 'pending'`). If parallel, the new brief is independent (`version: 1`, no
      `previousVersion`).
4. Redirect to `/briefs/[id]`.

## Review and confirm (`/briefs/[id]`)

- Renders every `brief-items` row as an editable form: text fields for `topic`/`angle`/`region`,
  a reorderable list for `priorityOrder` (drag or up/down controls renumbering the set),
  add/remove/reorder for `exclusions`/`bannedTerms`/`keywords` (all `hasMany: true` text arrays).
- "View original parse" toggle renders a diff against `rawParseSnapshot` via a new
  `diffBriefItems(original, current)` in `src/lib/brief-diff` — structural, keyed by `topic`,
  reporting `added`/`removed`/`changed` per field (same status vocabulary as
  `src/lib/content-diff`'s `BlockDiffStatus`, but this is a distinct, purpose-built function: the
  content-diff package is block-text-specific and doesn't fit structured multi-field rows).
- Save persists edits to the `brief-items` rows (brief stays `status: 'parsed'`).
- Confirm button: sets `editorial-briefs.status = 'confirmed'`, `confirmedBy`, `confirmedAt`.
  Requires desk-lead access (same `isLeadOfDesk` check).

## Confirm gate (data-layer enforcement)

A `beforeChange` hook on `brief-items` (mirroring `piece-assignments`'
`assertClaimAvailable` pattern):
```ts
export const assertBriefConfirmed: CollectionBeforeChangeHook<BriefItem> = async ({ req, data, originalDoc, operation }) => {
  if (operation !== 'update') return data
  if (originalDoc.status !== 'pending' || data?.status === 'pending' || data?.status === undefined) return data
  const brief = await req.payload.findByID({ collection: 'editorial-briefs', id: originalDoc.brief, depth: 0, overrideAccess: true })
  if (brief.status !== 'confirmed') {
    throw new APIError('Cannot advance a brief item before its brief is confirmed', 400)
  }
  return data
}
```
This blocks any future "start collection" code from moving a `brief-items.status` off `pending`
unless the parent brief is `confirmed` — the gate lives in the data layer, not just the UI, even
though no collection-trigger endpoint exists yet in this codebase to call it.

## Re-edit after confirm (criterion 6)

Editing any field on a `confirmed` brief's items (or the brief itself) does not mutate the
confirmed doc. Instead it runs the same supersede mechanics as duplicate-upload: a new
`editorial-briefs` doc (`version` + 1, `previousVersion` set, `status: 'parsed'`, items copied
from the confirmed version), the old one flips to `superseded`, and the lead is redirected to the
new draft's `/briefs/[id]` for review — full re-confirmation is required.

## Diff (criterion 8)

`src/lib/brief-diff/index.ts`:
```ts
export interface BriefItemDiffEntry {
  topic: string
  status: 'unchanged' | 'changed' | 'added' | 'removed'
  fieldChanges?: Record<string, { before: unknown; after: unknown }>
}
export function diffBriefItems(original: ParsedBriefItem[], current: BriefItem[]): BriefItemDiffEntry[]
```
Matched by `topic` (the LLM prompt already enforces `news_item.topic` exactly matches
`coverage_policies.topic`, so it's a stable-enough key within one parse). Both `rawParseSnapshot`
(immutable) and the live `brief-items` rows already exist in the data model — no extra storage
needed to make this diffable.

## Dashboard shell changes

### Sidebar
New `src/app/(dashboard)/Sidebar.tsx`: links to **Dashboard** (`/`), **Briefs** (`/briefs`), and
**Open admin panel** (`/admin`, rendered only when `user.role === 'admin'`).

### Header: channel switcher + logout
New `src/app/(dashboard)/Header.tsx` (server component, renders user email + a client
`ChannelSwitcher` + a `LogoutButton`):
- **Channel switcher**: options = `cms-client.listChannels()`, filtered to `user.leadOfDesks` for
  leads; admins/editors see the full list plus an **"All channels"** option, which is their
  default (preserves today's unfiltered dashboard behavior). Leads default to their first led
  desk (no "all" option for them). Selection persists in a `selected-channel` cookie, read
  server-side by the dashboard's `generated-pieces` queries (adds
  `where: { channel: { equals: selectedChannel } }` when a specific channel is selected) and by
  `/briefs/new`'s desk-dropdown default. Switching is a small client `<select>` whose `onChange`
  calls a server action that sets the cookie and calls `router.refresh()`.
- **Logout button**: server action clears the `payload-token` cookie, redirects to `/login`.

Both `Sidebar` and `Header` render inside `src/app/(dashboard)/layout.tsx`, wrapping `children` in
a simple two-column shell (sidebar + main content with header on top) — plain CSS added to the
existing `globals.css`, no new dependency.

## Testing

- Unit tests for `isLeadOfDesk`, `diffBriefItems`, and the extraction-schema's zero-topic
  rejection path (mock the Gemini call).
- Unit test for `assertBriefConfirmed`: blocks a status transition off `pending` when the parent
  brief isn't confirmed, allows it when confirmed, no-ops on creates and on updates that don't
  touch `status`.
- Manual verification: upload a brief as a lead for a desk they lead (succeeds), attempt as a
  non-lead (upload control disabled), upload a second brief same desk/day (duplicate prompt),
  confirm a brief then edit it (new version created, re-confirmation required), switch channels
  in the header and confirm the dashboard's piece queue filters accordingly.
