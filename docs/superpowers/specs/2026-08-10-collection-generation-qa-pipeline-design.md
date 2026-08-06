# Collection, generation, pre-QA, and publish pipeline

## Problem

Everything upstream (brief upload/parse/confirm) and downstream (claim/review/human-verdict
QA) of the actual editorial pipeline is built. The middle is not: nothing turns a confirmed
`brief-item` into provider search results, nothing turns a `collected-item` into a
`generated-piece`, and nothing checks a piece against editorial rules before a human reviews
it. This spec closes that gap, informed directly by `trt-editorial-n8n`'s real (n8n) production
workflow — reusing its proven prompts and structure while adapting them to this app's existing
schema and its human-verdict QA model (already built, not renegotiated here).

## Scope

In scope:
- `channel-configs`: a new local collection for the per-channel operational config this app's
  pipeline needs that neither `cms-prod` nor `providers` holds (target generation language,
  Event Registry language code, OKF guideline slug).
- A collection step: confirmed `brief-item` → query enabled `providers` for that channel →
  dedupe against `cms-prod`'s existing content → `collected-items`.
- A generation step: `collected-item` → Gemini, prompted with the story's own brief-item policy
  fields + the desk's OKF guideline text → `generated-pieces` (as `ContentBlock[]`, matching
  `src/lib/content-diff`'s existing shape, not a separate title/description/body triad).
- A pre-QA step: runs immediately after generation, surfaced on the existing review page as a
  read-only hint panel above the human `VerdictForm` already built — not a competing verdict.
  Two checks: the deterministic `no-banned-terms` OKF check (already specified in
  `okf-ruleset/checks/no-banned-terms.md`) and an LLM naturalness/AI-tell judge adapted from the
  prototype's `QA Validation` agent.
- A trigger: a "Start collection" action on a confirmed brief's review page that chains
  collect → generate → pre-QA for every `pending` brief-item, landing results in the existing
  unclaimed-pieces dashboard queue.
- A publish step: after a human submits `goodToGo`, a "Publish" action calls the already-built
  `cms-client.createArticle()`.

Out of scope (explicitly, to keep this landable):
- Slack notifications (prototype has them; nothing in this app's spec asked for them — pure
  YAGNI, not a gap).
- Automated multi-pass QA-revision loop (prototype retries generation once against QA feedback
  before auto-publishing). This app's QA is human-verdict-based already; the pre-QA hints feed
  a human, not an auto-retry loop.
- A job queue. Exactly like the brief-parse action, collection and generation run synchronously
  inside one server action request — acceptable at this app's scale, same ceiling already
  accepted elsewhere in this codebase.
- Cover-image selection (prototype has an LLM step for this; `generated-pieces` has no image
  field, and adding one is a separate, unscoped feature).
- Fuzzy same-story grouping across providers (`collected-items.groupKey`) — set to `null` for
  now; real cross-provider dedup is a substantial feature of its own.

## Data model

### New collection: `channel-configs`
```ts
{
  slug: 'channel-configs',
  access: { read: () => true, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [
    { name: 'channel', type: 'text', required: true, unique: true, index: true },
    { name: 'channelName', type: 'text' },
    { name: 'language', type: 'text', required: true, admin: { description: "e.g. 'English', 'Russian' - the language generation writes in." } },
    { name: 'erLang', type: 'text', admin: { description: "Event Registry language code, e.g. 'eng', 'rus'." } },
    { name: 'guidelineSlug', type: 'text', admin: { description: 'Matches a filename under okf-ruleset/guidelines/ (without .md). Empty = no desk-specific guideline.' } },
  ],
  timestamps: true,
}
```
Admin-only, matching `providers`' posture — this is pipeline operational config, not something
editors self-serve.

### `generated-pieces` — two new optional fields
```ts
{ name: 'publishedAt', type: 'date' },
{ name: 'cmsPackageId', type: 'text', admin: { description: 'The id createArticle() returned from trt-global-cms-prod.' } },
```

No other schema changes. `brief-items` already carries every story-specific policy field
(`sentiment`, `portrayalNotes`, `bannedTerms`, `requiredContext`) the prototype's
`coverage_policies` merge produces — that data is already collected at parse time, not
re-derived here.

## Collection

`collectForBriefItem(briefItem, brief): Promise<CollectedItem[]>`:
1. Load `providers` where `channels` includes `brief.channel` and `enabled`.
2. Build one `ProviderQuery` per provider: `channelId: brief.channel`, `language` from
   `channel-configs.erLang` (fallback `'eng'`), `searchQuery: briefItem.topic`,
   `keywordsIncluded: briefItem.keywords`.
3. `collectFromProviders(providers, query)` (already exists, unchanged).
4. For each normalized result, skip it if `cms-client.searchContent(result.headline, { channelId: brief.channel })` already returns a match (dedup against what's already published) —
   this is exactly what `searchContent`'s own doc comment says it's for.
5. Create one `collected-items` doc per surviving result: `briefItem`, `groupKey: null`,
   `headline`, `body`, `language`, `sources: [{ provider, providerItemId, sourceUrl,
   publishTimestamp, rawPayload: result.raw }]`.
6. Update `briefItem.status`: `'queried'` if any items were created, `'no-results'` if the
   provider calls succeeded but nothing survived, `'error'` if every provider failed
   (`collectFromProviders`'s `failures` covers all configured providers).

## Generation

`generatePiece(collectedItem, briefItem, brief): Promise<GeneratedPiece>`:
1. Load `channel-configs` for `brief.channel` (language, guidelineSlug).
2. Load the guideline body text via `getGuidelineText(guidelineSlug)` (new
   `src/lib/okf-ruleset` loader — strips the frontmatter block, returns the markdown body; `null`
   if the slug is empty or the file doesn't exist).
3. Gemini `generateObject`, schema `{ blocks: [{ type: 'heading'|'paragraph', text: string }] }`
   (one heading block first, paragraphs after — this app's block model has no separate
   title/description fields, unlike the prototype's `{title, description, article}`).
   System prompt: write in `channelConfig.language`; story-specific angle/sentiment/portrayal/
   required-context/banned-terms from `briefItem` (equivalent to the prototype's
   `policyOverride`, already collected at parse time — no re-derivation); the desk's OKF
   guideline text as general guidance; the same anti-AI-tell phrasing rules as the prototype's
   `Generate Article` system prompt (banned openings/transitions, vary sentence length, no
   paragraph over four sentences).
4. Mint `blockId`s via `crypto.randomUUID()` per block (matching `content-diff/blocks.ts`'s own
   pattern).
5. Create `generated-pieces`: `collectedItem`, `brief: briefItem.brief`, `channel: brief.channel`,
   `channelName`, `generatedSnapshot` = `currentBody` = the minted blocks,
   `attributionString` = `"Source: " + collectedItem.sources.map(s => provider name).join(', ')`,
   `sourceOnly: false`.

## Pre-QA (hint layer, not a verdict)

`runPreQaChecks(piece, briefItem): Promise<PreQaResult>`, computed fresh on each review-page
load (no persistence — this app's scale doesn't need caching, and caching would risk showing
stale hints against edited text):

1. **`no-banned-terms`** (deterministic, matches `okf-ruleset/checks/no-banned-terms.md`
   exactly): for each block in `piece.currentBody`, case-insensitive substring-match against
   `briefItem.bannedTerms`; each hit becomes `{ blockId, rule: 'no-banned-terms', severity:
   'hardFail', message: '"<term>" is a banned term for this story' }`.
2. **LLM naturalness/AI-tell judge** (Gemini, structured output, adapted directly from the
   prototype's `QA Validation` system prompt — same banned-phrase list, same structural red
   flags): returns `{ naturalnessScore, overallScore, reasoning, suggestions: string[] }`, shown
   as advisory (soft), never blocking.

Per `okf-ruleset/precedence.md` (already written, this spec doesn't change it): hard-fail hints
are surfaced prominently; soft-fail/LLM hints are advisory. The human still submits the actual
`qa-verdicts` row through the existing `VerdictForm` — pre-QA never writes to `qa-verdicts`
itself, since that collection requires a real human `submittedBy` and inventing a "system user"
to satisfy that would be exactly the kind of shim this codebase's existing comments warn against.

## Trigger: "Start collection" on the brief review page

A new action on `/briefs/[id]`, enabled only once `status === 'confirmed'`: iterates every
`pending` `brief-item` for that brief, running collect → generate for each collected item,
sequentially (no queue, matching the brief-parse action's own synchronous precedent). Reports a
summary (`N items collected, M pieces generated`) rather than per-item progress — acceptable
given this runs inside one request/response cycle.

## Publish

A "Publish" button on the piece review page, shown only when the latest `qa-verdicts` for that
piece is `goodToGo`: converts `currentBody` blocks to `cms-client.createArticle()`'s
`{ title, description, paragraphs }` shape (title = first heading block's text, description =
empty string — the prototype's `description` has no equivalent source field in this app's
model, and inventing one is out of scope), calls `createArticle`, stores the returned id in
`generated-pieces.cmsPackageId` and sets `publishedAt`.

## Testing

- `collectForBriefItem`: unit tests mocking `collectFromProviders` and `cms-client`, covering
  the three `briefItem.status` outcomes and the dedup-skip path.
- `generatePiece`: unit test mocking the Gemini call, asserting block shape and
  `attributionString` construction.
- `no-banned-terms` check: pure function, straightforward table-driven tests.
- `getGuidelineText`: unit test against a real fixture file (already have one:
  `gaza-ceasefire-example.md`) plus the missing-slug case.
- Manual verification is blocked by the same `CMS_BASE_URL`/`GOOGLE_GENERATIVE_AI_API_KEY`
  environment gaps already documented for the brief-upload feature — noted, not worked around.
