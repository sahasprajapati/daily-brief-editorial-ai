# Collection, Generation, Pre-QA, and Publish Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a confirmed brief into collected source items, generated pieces, and pre-QA hints — closing the gap between brief confirmation and the existing claim/review/human-verdict flow — and let a `goodToGo` piece publish to `trt-global-cms-prod`.

**Architecture:** Two new orchestration functions (`collectForBriefItem`, `generatePiece`) called synchronously (no queue, same precedent as the brief-parse action) from a new "Start collection" trigger on the brief review page. A pre-QA hint layer (deterministic banned-terms check + an LLM naturalness judge, both adapted from the real `trt-editorial-n8n` production prompts) computes fresh on each piece-review-page load and is shown above the existing human `VerdictForm` — it never writes its own `qa-verdicts` row. A "Publish" button appears once the latest verdict is `goodToGo` and calls the already-built `cms-client.createArticle()`.

**Tech Stack:** Same as the rest of this app — Payload 3 Local API, `ai` + `@ai-sdk/google`, `zod`, `bun:test`.

## Global Constraints

- Every write from these new orchestration functions runs as the triggering lead/admin user
  (`overrideAccess: false, user`), never as a fabricated "system" user — so every collection
  that gets written to (`collected-items`, `generated-pieces`, `brief-items` status updates)
  needs real lead-of-desk access wired in, not `adminOnly`. This plan's Task 1 fixes both
  `collected-items.create` and `generated-pieces.create`, which are still `adminOnly` today —
  the exact class of bug caught live twice already in the brief-upload feature
  (`brief-items.create`/`delete`). Fix it up front this time instead of discovering it live.
- Pre-QA is a **hint layer**, not a verdict-writer: `qa-verdicts.submittedBy` is a required
  relationship to `users` and there is no "system user" concept in this app — don't invent one.
- No job queue exists anywhere in this codebase; collection and generation run sequentially
  inside one server-action request, same as the brief-parse action already does.
- `CMS_BASE_URL`/`CMS_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY` are unset/placeholder in this dev
  environment — every manual-verification step is scoped to what's actually checkable (unit
  tests with mocked Gemini/HTTP calls, type-checking, resilient-failure rendering), with the
  live end-to-end path documented as blocked, not silently worked around.
- Path aliases: `@/*` → `./src/*`, `@payload-config` → `./src/payload.config.ts`.

---

## File Structure

```
src/payload/access/admin.ts                          (modify) - add leadOfDeskCollectedItemCreate,
                                                                  leadOfDeskPieceCreate
src/payload/access/admin.test.ts                      (modify) - tests for the above

src/payload/collections/collected-items/index.ts       (modify) - wire create access
src/payload/collections/generated-pieces/index.ts       (modify) - wire create access, add
                                                                    publishedAt/cmsPackageId fields
src/payload/collections/channel-configs/index.ts        (create) - new collection
src/payload.config.ts                                   (modify) - register ChannelConfigs

src/lib/okf-ruleset/index.ts                            (create) - getGuidelineText()
src/lib/okf-ruleset/index.test.ts                        (create)

src/lib/pre-qa/no-banned-terms.ts                        (create) - checkNoBannedTerms()
src/lib/pre-qa/no-banned-terms.test.ts                    (create)
src/lib/pre-qa/gemini.ts                                 (create) - runNaturalnessCheck()
src/lib/pre-qa/index.ts                                  (create) - runPreQaChecks()
src/lib/pre-qa/index.test.ts                              (create)

src/lib/generation/schema.ts                             (create) - zod schema for generated blocks
src/lib/generation/gemini.ts                             (create) - runGeneration()
src/lib/generation/index.ts                              (create) - generatePiece()
src/lib/generation/index.test.ts                          (create)

src/lib/collection/index.ts                              (create) - collectForBriefItem()
src/lib/collection/index.test.ts                          (create)

src/app/(dashboard)/briefs/[id]/actions.ts               (modify) - add startCollection()
src/app/(dashboard)/briefs/[id]/StartCollectionButton.tsx (create)
src/app/(dashboard)/briefs/[id]/page.tsx                 (modify) - wire the button

src/app/(dashboard)/pieces/[id]/actions.ts               (modify) - add publishPiece()
src/app/(dashboard)/pieces/[id]/PreQaHints.tsx           (create)
src/app/(dashboard)/pieces/[id]/PublishButton.tsx        (create)
src/app/(dashboard)/pieces/[id]/page.tsx                 (modify) - wire hints + publish button
```

---

### Task 1: Fix create access on `collected-items` and `generated-pieces`

**Files:**
- Modify: `src/payload/access/admin.ts`
- Modify: `src/payload/access/admin.test.ts`
- Modify: `src/payload/collections/collected-items/index.ts`
- Modify: `src/payload/collections/generated-pieces/index.ts`

**Interfaces:**
- Produces (used by Tasks 6, 7): `leadOfDeskCollectedItemCreate: Access`,
  `leadOfDeskPieceCreate: Access`.

- [ ] **Step 1: Write the failing tests**

Append to `src/payload/access/admin.test.ts`:

```ts
import {
  leadOfDeskCollectedItemCreate,
  leadOfDeskPieceCreate,
  // ...keep existing imports, just add these two
} from './admin'

function fakeFindByIDBriefWithBriefChannel(channel: string) {
  return async () => ({ id: 'item-1', brief: { channel } } as any)
}

function fakeFindByIDChannelOnly(channel: string) {
  return async () => ({ id: 'brief-1', channel } as any)
}

describe('leadOfDeskCollectedItemCreate', () => {
  test('admin can create for any briefItem', async () => {
    const req = { user: admin, payload: { findByID: fakeFindByIDBriefWithBriefChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskCollectedItemCreate({ req, data: { briefItem: 'item-1' } } as any)).toBe(true)
  })

  test('lead of the briefItem parent brief channel can create', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead, payload: { findByID: fakeFindByIDBriefWithBriefChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskCollectedItemCreate({ req, data: { briefItem: 'item-1' } } as any)).toBe(true)
  })

  test('non-lead cannot create', async () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2, payload: { findByID: fakeFindByIDBriefWithBriefChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskCollectedItemCreate({ req, data: { briefItem: 'item-1' } } as any)).toBe(false)
  })

  test('missing data.briefItem is denied for a non-admin', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead, payload: { findByID: fakeFindByIDBriefWithBriefChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskCollectedItemCreate({ req, data: {} } as any)).toBe(false)
  })
})

describe('leadOfDeskPieceCreate', () => {
  test('admin can create for any brief', async () => {
    const req = { user: admin, payload: { findByID: fakeFindByIDChannelOnly('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskPieceCreate({ req, data: { brief: 'brief-1' } } as any)).toBe(true)
  })

  test('lead of the brief channel can create', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead, payload: { findByID: fakeFindByIDChannelOnly('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskPieceCreate({ req, data: { brief: 'brief-1' } } as any)).toBe(true)
  })

  test('non-lead cannot create', async () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2, payload: { findByID: fakeFindByIDChannelOnly('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskPieceCreate({ req, data: { brief: 'brief-1' } } as any)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/payload/access/admin.test.ts`
Expected: FAIL — the two new exports don't exist.

- [ ] **Step 3: Implement the access functions**

Append to `src/payload/access/admin.ts`:

```ts
/** Collected-items are always created programmatically by the collection step, acting as the
 *  triggering lead - gated via data.briefItem's parent brief's channel, two hops out since the
 *  item doesn't exist yet to look up its own relationships. */
export const leadOfDeskCollectedItemCreate: Access = async ({ req, data }) => {
  const typedUser = req.user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!data?.briefItem) return false
  const briefItem = await req.payload.findByID({
    collection: 'brief-items',
    id: data.briefItem,
    depth: 1,
    overrideAccess: true,
  })
  const channel = typeof briefItem?.brief === 'object' ? briefItem.brief.channel : undefined
  return isLeadOfDesk(typedUser, channel)
}

/** generated-pieces.brief is denormalized (see the collection's own doc comment) so this is a
 *  single-hop lookup, unlike leadOfDeskCollectedItemCreate. */
export const leadOfDeskPieceCreate: Access = async ({ req, data }) => {
  const typedUser = req.user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!data?.brief) return false
  const brief = await req.payload.findByID({
    collection: 'editorial-briefs',
    id: data.brief,
    depth: 0,
    overrideAccess: true,
  })
  return isLeadOfDesk(typedUser, brief?.channel)
}
```

- [ ] **Step 4: Wire into the two collections**

In `src/payload/collections/collected-items/index.ts`:

```ts
import { leadOfDeskCollectedItemCreate, adminOnly } from '../../access/admin'
```
```ts
    create: leadOfDeskCollectedItemCreate,
```
(`update`/`delete` stay `adminOnly` — nothing in this plan updates or deletes a `collected-items`
doc after creation.)

In `src/payload/collections/generated-pieces/index.ts`:

```ts
import { adminOnly, leadOfDeskPieceCreate, ownAssignedPieceUpdate } from '../../access/admin'
```
```ts
    create: leadOfDeskPieceCreate,
```
(`update` stays `ownAssignedPieceUpdate`, unchanged.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/payload/access/admin.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/payload/access/admin.ts src/payload/access/admin.test.ts \
        src/payload/collections/collected-items/index.ts \
        src/payload/collections/generated-pieces/index.ts
git commit -m "feat: let leads create collected-items and generated-pieces for their own desk"
```

---

### Task 2: `channel-configs` collection + `generated-pieces` publish fields

**Files:**
- Create: `src/payload/collections/channel-configs/index.ts`
- Modify: `src/payload/collections/generated-pieces/index.ts`
- Modify: `src/payload.config.ts`

**Interfaces:**
- Produces: `channel-configs` collection (slug `channel-configs` → `ChannelConfig` generated type,
  fields `channel`, `channelName`, `language`, `erLang`, `guidelineSlug`).
  `generated-pieces.publishedAt: string | null`, `.cmsPackageId: string | null`.

- [ ] **Step 1: Create the collection**

Create `src/payload/collections/channel-configs/index.ts`:

```ts
import type { CollectionConfig } from 'payload'
import { adminOnly } from '../../access/admin'

/** Operational config the collection/generation pipeline needs that neither cms-prod nor
 *  `providers` has: what language to generate in, Event Registry's language code for this
 *  desk, and which okf-ruleset guideline file (if any) applies. Unlike channel identity
 *  (name/language, owned by cms-prod), this is pipeline-specific - it belongs here. */
export const ChannelConfigs: CollectionConfig = {
  slug: 'channel-configs',
  admin: {
    useAsTitle: 'channel',
    defaultColumns: ['channel', 'channelName', 'language', 'guidelineSlug'],
  },
  access: {
    read: () => true,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    { name: 'channel', type: 'text', required: true, unique: true, index: true },
    { name: 'channelName', type: 'text' },
    {
      name: 'language',
      type: 'text',
      required: true,
      admin: { description: "e.g. 'English', 'Russian' - the language generation writes in." },
    },
    {
      name: 'erLang',
      type: 'text',
      admin: { description: "Event Registry language code, e.g. 'eng', 'rus'." },
    },
    {
      name: 'guidelineSlug',
      type: 'text',
      admin: {
        description:
          'Matches a filename under okf-ruleset/guidelines/ (without .md). Empty = no desk-specific guideline.',
      },
    },
  ],
  timestamps: true,
}
```

- [ ] **Step 2: Add publish fields to generated-pieces**

In `src/payload/collections/generated-pieces/index.ts`, add to `fields` (after `restrictionReason`):

```ts
    { name: 'publishedAt', type: 'date' },
    {
      name: 'cmsPackageId',
      type: 'text',
      admin: { description: 'The id createArticle() returned from trt-global-cms-prod.' },
    },
```

- [ ] **Step 3: Register the collection**

In `src/payload.config.ts`:

```ts
import { ChannelConfigs } from './payload/collections/channel-configs'
```
```ts
    BriefFiles,
    ChannelConfigs,
  ],
```

- [ ] **Step 4: Regenerate types and type-check**

Run: `bun run generate:types`
Run: `bun run check-types`
Expected: no new errors; `ChannelConfig` interface exists in `@/payload-types`.

- [ ] **Step 5: Commit**

```bash
git add src/payload/collections/channel-configs src/payload/collections/generated-pieces/index.ts \
        src/payload.config.ts src/payload-types.ts
git commit -m "feat: add channel-configs collection and generated-pieces publish fields"
```

---

### Task 3: OKF guideline loader

**Files:**
- Create: `src/lib/okf-ruleset/index.ts`
- Test: `src/lib/okf-ruleset/index.test.ts`

**Interfaces:**
- Produces (used by Task 5): `getGuidelineText(slug: string | null | undefined): Promise<string | null>`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/okf-ruleset/index.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { getGuidelineText } from './index'

describe('getGuidelineText', () => {
  test('returns null for a null/undefined/empty slug', async () => {
    expect(await getGuidelineText(null)).toBeNull()
    expect(await getGuidelineText(undefined)).toBeNull()
    expect(await getGuidelineText('')).toBeNull()
  })

  test('returns null when the guideline file does not exist', async () => {
    expect(await getGuidelineText('no-such-guideline')).toBeNull()
  })

  test('strips frontmatter and returns the body for a real guideline', async () => {
    const text = await getGuidelineText('gaza-ceasefire-example')
    expect(text).not.toBeNull()
    expect(text).not.toContain('---')
    expect(text).toContain('# Gaza ceasefire coverage')
    expect(text).toContain('Depends on:')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/lib/okf-ruleset/index.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the loader**

Create `src/lib/okf-ruleset/index.ts`:

```ts
import { readFile } from 'fs/promises'
import path from 'path'

const OKF_ROOT = path.join(process.cwd(), 'okf-ruleset')

/** Strips the leading YAML frontmatter block (between the first two `---` lines) - the
 *  generation prompt only needs the guideline's prose, not its structured metadata. */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?/)
  return match ? content.slice(match[0].length).trim() : content.trim()
}

export async function getGuidelineText(slug: string | null | undefined): Promise<string | null> {
  if (!slug) return null
  try {
    const content = await readFile(path.join(OKF_ROOT, 'guidelines', `${slug}.md`), 'utf-8')
    return stripFrontmatter(content)
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/lib/okf-ruleset/index.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/okf-ruleset
git commit -m "feat: add OKF guideline loader"
```

---

### Task 4: Pre-QA — deterministic no-banned-terms check

**Files:**
- Create: `src/lib/pre-qa/no-banned-terms.ts`
- Test: `src/lib/pre-qa/no-banned-terms.test.ts`

**Interfaces:**
- Consumes: `ContentBlock` from `@/lib/content-diff`.
- Produces (used by Task 5): `checkNoBannedTerms(blocks, bannedTerms): PreQaFlag[]`,
  `interface PreQaFlag { blockId: string; rule: string; severity: 'hardFail' | 'softFail'; message: string }`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/pre-qa/no-banned-terms.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { checkNoBannedTerms } from './no-banned-terms'

describe('checkNoBannedTerms', () => {
  test('flags a block containing a banned term, case-insensitively', () => {
    const blocks = [{ blockId: 'b1', type: 'paragraph' as const, text: 'The flood of illegal migrants continued.' }]
    const flags = checkNoBannedTerms(blocks, ['illegal migrants', 'flood'])
    expect(flags).toHaveLength(2)
    expect(flags[0]).toMatchObject({ blockId: 'b1', rule: 'no-banned-terms', severity: 'hardFail' })
  })

  test('returns no flags when no banned term appears', () => {
    const blocks = [{ blockId: 'b1', type: 'paragraph' as const, text: 'Undocumented migrants arrived today.' }]
    expect(checkNoBannedTerms(blocks, ['illegal migrants', 'flood'])).toEqual([])
  })

  test('returns no flags when bannedTerms is empty', () => {
    const blocks = [{ blockId: 'b1', type: 'paragraph' as const, text: 'Anything goes here.' }]
    expect(checkNoBannedTerms(blocks, [])).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/lib/pre-qa/no-banned-terms.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the check**

Create `src/lib/pre-qa/no-banned-terms.ts`:

```ts
import type { ContentBlock } from '@/lib/content-diff'

export interface PreQaFlag {
  blockId: string
  rule: string
  severity: 'hardFail' | 'softFail'
  message: string
}

/** Implements okf-ruleset/checks/no-banned-terms.md: fails the piece if it contains any term
 *  listed in the matching brief item's bannedTerms. */
export function checkNoBannedTerms(blocks: ContentBlock[], bannedTerms: string[]): PreQaFlag[] {
  const flags: PreQaFlag[] = []
  for (const block of blocks) {
    const lowerText = block.text.toLowerCase()
    for (const term of bannedTerms) {
      if (term && lowerText.includes(term.toLowerCase())) {
        flags.push({
          blockId: block.blockId,
          rule: 'no-banned-terms',
          severity: 'hardFail',
          message: `"${term}" is a banned term for this story`,
        })
      }
    }
  }
  return flags
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/lib/pre-qa/no-banned-terms.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pre-qa/no-banned-terms.ts src/lib/pre-qa/no-banned-terms.test.ts
git commit -m "feat: add deterministic no-banned-terms pre-QA check"
```

---

### Task 5: Pre-QA — LLM naturalness judge + orchestration

**Files:**
- Create: `src/lib/pre-qa/gemini.ts`
- Create: `src/lib/pre-qa/index.ts`
- Test: `src/lib/pre-qa/index.test.ts`

**Interfaces:**
- Consumes: `checkNoBannedTerms` (Task 4), `ContentBlock` from `@/lib/content-diff`.
- Produces (used by Task 9): `runPreQaChecks(blocks, bannedTerms): Promise<PreQaResult>`,
  `interface PreQaResult { flags: PreQaFlag[]; naturalnessScore: number; overallScore: number; reasoning: string; suggestions: string[] }`.

- [ ] **Step 1: Write the Gemini naturalness-check wrapper**

Create `src/lib/pre-qa/gemini.ts`:

```ts
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

const naturalnessSchema = z.object({
  naturalnessScore: z.number(),
  overallScore: z.number(),
  reasoning: z.string(),
  suggestions: z.array(z.string()).default([]),
})

export type NaturalnessResult = z.infer<typeof naturalnessSchema>

/** Adapted from trt-editorial-n8n/trt-daily-editorial.json's "QA Validation" agent - same
 *  AI-detection heuristics (forbidden phrases, structural red flags), advisory only: this
 *  never blocks anything, it feeds the human reviewer's own verdict. */
const SYSTEM_PROMPT = `You are a TRT editorial QA reviewer checking a generated article for natural
journalistic flow and signs of AI-generated text.

Forbidden phrases to flag if present: "Imagine...", "Picture this...", "It's not just X but also Y",
"At first glance... but look closer", "It's worth noting that...", "In conclusion...", "The takeaway
here is...", "signifies a landmark moment".

Structural red flags: every paragraph following an intro-development-conclusion pattern, overly
balanced coverage without editorial focus, academic tone instead of journalistic voice, repetitive
sentence structures throughout.

Score naturalness and overall quality 0-100 and list concrete rewrite suggestions.`

export async function runNaturalnessCheck(articleText: string): Promise<NaturalnessResult> {
  const { object } = await generateObject({
    model: google('gemini-2.0-flash'),
    schema: naturalnessSchema,
    system: SYSTEM_PROMPT,
    prompt: articleText,
  })
  return object
}
```

- [ ] **Step 2: Write the failing tests for the orchestrator**

Create `src/lib/pre-qa/index.test.ts`:

```ts
import { describe, expect, spyOn, test } from 'bun:test'
import * as gemini from './gemini'
import { runPreQaChecks } from './index'

const naturalnessResult = { naturalnessScore: 80, overallScore: 75, reasoning: 'Reads well.', suggestions: ['Tighten the intro.'] }

describe('runPreQaChecks', () => {
  test('combines banned-term flags with the naturalness check result', async () => {
    spyOn(gemini, 'runNaturalnessCheck').mockResolvedValue(naturalnessResult)

    const blocks = [{ blockId: 'b1', type: 'paragraph' as const, text: 'The flood continued today.' }]
    const result = await runPreQaChecks(blocks, ['flood'])

    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toMatchObject({ blockId: 'b1', rule: 'no-banned-terms' })
    expect(result.naturalnessScore).toBe(80)
    expect(result.overallScore).toBe(75)
    expect(result.suggestions).toEqual(['Tighten the intro.'])
  })

  test('returns no flags when no banned terms match', async () => {
    spyOn(gemini, 'runNaturalnessCheck').mockResolvedValue(naturalnessResult)

    const blocks = [{ blockId: 'b1', type: 'paragraph' as const, text: 'Clean text.' }]
    const result = await runPreQaChecks(blocks, [])

    expect(result.flags).toEqual([])
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test src/lib/pre-qa/index.test.ts`
Expected: FAIL — `./index` doesn't exist.

- [ ] **Step 4: Implement the orchestrator**

Create `src/lib/pre-qa/index.ts`:

```ts
import type { ContentBlock } from '@/lib/content-diff'
import { checkNoBannedTerms, type PreQaFlag } from './no-banned-terms'
import { runNaturalnessCheck } from './gemini'

export interface PreQaResult {
  flags: PreQaFlag[]
  naturalnessScore: number
  overallScore: number
  reasoning: string
  suggestions: string[]
}

/** Computed fresh on every review-page load, never persisted or written as a qa-verdicts row -
 *  see the design spec's "Pre-QA (hint layer, not a verdict)" section for why. */
export async function runPreQaChecks(blocks: ContentBlock[], bannedTerms: string[]): Promise<PreQaResult> {
  const flags = checkNoBannedTerms(blocks, bannedTerms)
  const articleText = blocks.map((block) => block.text).join('\n\n')
  const naturalness = await runNaturalnessCheck(articleText)
  return { flags, ...naturalness }
}

export type { PreQaFlag } from './no-banned-terms'
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/lib/pre-qa/index.test.ts`
Expected: PASS, both tests.

- [ ] **Step 6: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pre-qa
git commit -m "feat: add LLM naturalness pre-QA check and hint orchestrator"
```

---

### Task 6: Generation

**Files:**
- Create: `src/lib/generation/schema.ts`
- Create: `src/lib/generation/gemini.ts`
- Create: `src/lib/generation/index.ts`
- Test: `src/lib/generation/index.test.ts`

**Interfaces:**
- Consumes: `getGuidelineText` (Task 3), `Payload`/`User`/`CollectedItem`/`BriefItem`/
  `EditorialBrief`/`ChannelConfig`/`GeneratedPiece` from `payload`/`@/payload-types`.
- Produces (used by Task 8): `generatePiece(payload, user, collectedItem, briefItem, brief, channelConfig): Promise<GeneratedPiece>`.

- [ ] **Step 1: Write the extraction schema**

Create `src/lib/generation/schema.ts`:

```ts
import { z } from 'zod'

export const generatedPieceSchema = z.object({
  blocks: z.array(
    z.object({
      type: z.enum(['heading', 'paragraph']),
      text: z.string(),
    }),
  ),
})

export type GeneratedPieceBlocks = z.infer<typeof generatedPieceSchema>
```

- [ ] **Step 2: Write the Gemini generation wrapper**

Create `src/lib/generation/gemini.ts`:

```ts
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { generatedPieceSchema, type GeneratedPieceBlocks } from './schema'

export interface GenerationInput {
  topic: string
  language: string
  angle: string
  sentiment: string
  portrayalNotes: string
  requiredContext: string
  bannedTerms: string[]
  guidelineText: string | null
  sourceHeadline: string
  sourceBody: string
}

/** Adapted from trt-editorial-n8n/trt-daily-editorial.json's "Generate Article" agent - same
 *  anti-AI-tell writing standards. Story-specific guidance comes straight from the brief-item
 *  (this app already collects it at parse time, unlike the prototype's separate Sheet-driven
 *  policyOverride); the desk's general OKF guideline supplements it. */
function buildSystemPrompt(input: GenerationInput): string {
  return `You are a TRT editorial writer producing one article from the source material below.

STORY: ${input.topic}
LANGUAGE: write the entire output in ${input.language}.

STORY-SPECIFIC GUIDANCE (overrides general guidance on conflict):
- Angle: ${input.angle || 'none specified'}
- Sentiment: ${input.sentiment || 'none specified'}
- Portrayal notes: ${input.portrayalNotes || 'none specified'}
- Required context: ${input.requiredContext || 'none specified'}
- Banned terms (never use): ${input.bannedTerms.length > 0 ? input.bannedTerms.join(', ') : 'none'}

GENERAL DESK GUIDELINE:
${input.guidelineText ?? 'None provided.'}

WRITING STANDARDS:
- Open inside the story's key fact, not scene-setting.
- Vary sentence length. No paragraph over four sentences.
- Never use these AI-tell openings/transitions: "Imagine...", "Picture this...", "It's not just X
  but also Y", "At first glance... but look closer", "It's worth noting that...", "In conclusion...",
  "The takeaway here is...", "signifies a landmark moment".
- Weave quotes naturally into the narrative, don't just append them.

Return exactly one heading block (the headline) followed by paragraph blocks (the body).`
}

export async function runGeneration(input: GenerationInput): Promise<GeneratedPieceBlocks> {
  const { object } = await generateObject({
    model: google('gemini-2.0-flash'),
    schema: generatedPieceSchema,
    system: buildSystemPrompt(input),
    prompt: `SOURCE HEADLINE: ${input.sourceHeadline}\n\nSOURCE BODY:\n${input.sourceBody}`,
  })
  return object
}
```

- [ ] **Step 3: Write the failing test for `generatePiece`**

Create `src/lib/generation/index.test.ts`:

```ts
import { describe, expect, spyOn, test } from 'bun:test'
import type { CollectedItem, BriefItem, EditorialBrief, ChannelConfig, User } from '@/payload-types'
import * as gemini from './gemini'
import { generatePiece } from './index'

const user = { id: 'lead-1', role: 'editor' } as User

const collectedItem = {
  id: 'collected-1',
  headline: 'Test headline',
  body: 'Test body',
  sources: [{ provider: { id: 'p1', name: 'Test Wire' }, providerItemId: 'x' }],
} as unknown as CollectedItem

const briefItem = {
  id: 'item-1',
  topic: 'Test topic',
  angle: 'Test angle',
  sentiment: 'neutral',
  portrayalNotes: '',
  requiredContext: '',
  bannedTerms: ['flood'],
} as unknown as BriefItem

const brief = { id: 'brief-1', channel: 'ch-1', channelName: 'Test Channel' } as EditorialBrief
const channelConfig = { id: 'cc-1', channel: 'ch-1', language: 'English', guidelineSlug: null } as unknown as ChannelConfig

function fakePayload() {
  const created: any[] = []
  return {
    created,
    payload: {
      create: async ({ data }: any) => {
        const doc = { id: 'piece-1', ...data }
        created.push(doc)
        return doc
      },
    },
  }
}

describe('generatePiece', () => {
  test('mints blocks with ids and builds the attribution string from sources', async () => {
    spyOn(gemini, 'runGeneration').mockResolvedValue({
      blocks: [
        { type: 'heading', text: 'Generated headline' },
        { type: 'paragraph', text: 'Generated paragraph.' },
      ],
    })

    const { payload, created } = fakePayload()
    const piece = await generatePiece(payload as any, user, collectedItem, briefItem, brief, channelConfig)

    expect(piece.generatedSnapshot).toHaveLength(2)
    expect((piece.generatedSnapshot as any[])[0]).toMatchObject({ type: 'heading', text: 'Generated headline' })
    expect((piece.generatedSnapshot as any[])[0].blockId).toBeTruthy()
    expect(piece.currentBody).toEqual(piece.generatedSnapshot)
    expect(piece.attributionString).toBe('Source: Test Wire')
    expect(piece.channel).toBe('ch-1')
    expect(created[0].collectedItem).toBe('collected-1')
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `bun test src/lib/generation/index.test.ts`
Expected: FAIL — `./index` doesn't exist.

- [ ] **Step 5: Implement `generatePiece`**

Create `src/lib/generation/index.ts`:

```ts
import type { Payload } from 'payload'
import type { BriefItem, ChannelConfig, CollectedItem, EditorialBrief, GeneratedPiece, User } from '@/payload-types'
import type { ContentBlock } from '@/lib/content-diff'
import { getGuidelineText } from '@/lib/okf-ruleset'
import { runGeneration } from './gemini'

export async function generatePiece(
  payload: Payload,
  user: User,
  collectedItem: CollectedItem,
  briefItem: BriefItem,
  brief: EditorialBrief,
  channelConfig: ChannelConfig | null,
): Promise<GeneratedPiece> {
  const guidelineText = await getGuidelineText(channelConfig?.guidelineSlug)

  const result = await runGeneration({
    topic: briefItem.topic,
    language: channelConfig?.language ?? 'English',
    angle: briefItem.angle ?? '',
    sentiment: briefItem.sentiment ?? '',
    portrayalNotes: briefItem.portrayalNotes ?? '',
    requiredContext: briefItem.requiredContext ?? '',
    bannedTerms: briefItem.bannedTerms ?? [],
    guidelineText,
    sourceHeadline: collectedItem.headline,
    sourceBody: collectedItem.body,
  })

  const blocks: ContentBlock[] = result.blocks.map((block) => ({
    blockId: crypto.randomUUID(),
    type: block.type,
    text: block.text,
  }))

  const providerNames = collectedItem.sources.map((source) =>
    typeof source.provider === 'object' ? source.provider.name : source.provider,
  )
  const attributionString = `Source: ${providerNames.join(', ')}`

  return payload.create({
    collection: 'generated-pieces',
    data: {
      collectedItem: collectedItem.id,
      brief: brief.id,
      channel: brief.channel,
      channelName: brief.channelName,
      generatedSnapshot: blocks,
      currentBody: blocks,
      attributionString,
      sourceOnly: false,
    },
    overrideAccess: false,
    user,
  })
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun test src/lib/generation/index.test.ts`
Expected: PASS.

- [ ] **Step 7: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/generation
git commit -m "feat: add piece generation from a collected item"
```

---

### Task 7: Collection

**Files:**
- Create: `src/lib/collection/index.ts`
- Test: `src/lib/collection/index.test.ts`

**Interfaces:**
- Consumes: `collectFromProviders` from `@/lib/provider-client`, `CmsClient` from `@/lib/cms-client`.
- Produces (used by Task 8): `collectForBriefItem(payload, user, cmsClient, briefItem, brief): Promise<{ collectedItems: CollectedItem[]; status: BriefItem['status'] }>`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/collection/index.test.ts`:

```ts
import { describe, expect, spyOn, test } from 'bun:test'
import type { BriefItem, EditorialBrief, Provider, User } from '@/payload-types'
import * as providerClient from '@/lib/provider-client'
import { collectForBriefItem } from './index'

const user = { id: 'lead-1', role: 'editor' } as User
const briefItem = { id: 'item-1', topic: 'Gaza ceasefire', keywords: ['Gaza'], status: 'pending' } as unknown as BriefItem
const brief = { id: 'brief-1', channel: 'ch-1' } as EditorialBrief

const provider = {
  id: 'provider-1',
  name: 'Test Wire',
  type: 'eventRegistry',
  enabled: true,
  baseUrl: 'https://example.test',
  apiKeyEnvVar: 'TEST_KEY',
  channels: ['ch-1'],
} as unknown as Provider

function fakePayload({ providers = [provider], channelConfigs = [] as any[] } = {}) {
  const created: any[] = []
  const updated: any[] = []
  return {
    created,
    updated,
    payload: {
      find: async ({ collection }: any) => {
        if (collection === 'providers') return { docs: providers }
        if (collection === 'channel-configs') return { docs: channelConfigs }
        return { docs: [] }
      },
      create: async ({ data }: any) => {
        const doc = { id: `collected-${created.length}`, ...data }
        created.push(doc)
        return doc
      },
      update: async ({ id, data }: any) => {
        updated.push({ id, data })
        return { id, ...data }
      },
    },
  }
}

function fakeCmsClient(existingHeadlines: string[] = []) {
  return {
    searchContent: async (query: string) =>
      existingHeadlines.includes(query) ? [{ id: 'existing-1', title: query }] : [],
  } as any
}

describe('collectForBriefItem', () => {
  test('creates a collected-item per normalized result and marks the brief-item queried', async () => {
    spyOn(providerClient, 'collectFromProviders').mockResolvedValue({
      results: [
        {
          providerId: 'provider-1',
          providerName: 'Test Wire',
          items: [
            {
              providerId: 'provider-1',
              providerItemId: 'ext-1',
              source: 'Test Wire',
              publishTimestamp: '2026-08-10T00:00:00.000Z',
              language: 'en',
              headline: 'New story',
              body: 'Body text',
              raw: {},
            },
          ],
        },
      ],
      failures: [],
    })

    const { payload, created, updated } = fakePayload()
    const cmsClient = fakeCmsClient()

    const result = await collectForBriefItem(payload as any, user, cmsClient, briefItem, brief)

    expect(result.status).toBe('queried')
    expect(result.collectedItems).toHaveLength(1)
    expect(created[0]).toMatchObject({ briefItem: 'item-1', headline: 'New story' })
    expect(updated[0]).toMatchObject({ id: 'item-1', data: { status: 'queried' } })
  })

  test('skips a result that already exists in cms-prod (dedup)', async () => {
    spyOn(providerClient, 'collectFromProviders').mockResolvedValue({
      results: [
        {
          providerId: 'provider-1',
          providerName: 'Test Wire',
          items: [
            {
              providerId: 'provider-1',
              providerItemId: 'ext-1',
              source: 'Test Wire',
              publishTimestamp: '2026-08-10T00:00:00.000Z',
              language: 'en',
              headline: 'Already published',
              body: 'Body text',
              raw: {},
            },
          ],
        },
      ],
      failures: [],
    })

    const { payload, created, updated } = fakePayload()
    const cmsClient = fakeCmsClient(['Already published'])

    const result = await collectForBriefItem(payload as any, user, cmsClient, briefItem, brief)

    expect(result.status).toBe('no-results')
    expect(created).toHaveLength(0)
    expect(updated[0]).toMatchObject({ id: 'item-1', data: { status: 'no-results' } })
  })

  test('marks the brief-item error when every configured provider fails', async () => {
    spyOn(providerClient, 'collectFromProviders').mockResolvedValue({
      results: [],
      failures: [{ providerId: 'provider-1', providerName: 'Test Wire', error: 'timeout' }],
    })

    const { payload, updated } = fakePayload()
    const cmsClient = fakeCmsClient()

    const result = await collectForBriefItem(payload as any, user, cmsClient, briefItem, brief)

    expect(result.status).toBe('error')
    expect(updated[0]).toMatchObject({ id: 'item-1', data: { status: 'error' } })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/lib/collection/index.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `collectForBriefItem`**

Create `src/lib/collection/index.ts`:

```ts
import type { Payload } from 'payload'
import type { BriefItem, CollectedItem, EditorialBrief, Provider, User } from '@/payload-types'
import { collectFromProviders, type ProviderConfig, type ProviderQuery } from '@/lib/provider-client'
import type { CmsClient } from '@/lib/cms-client'

function toProviderConfig(doc: Provider): ProviderConfig {
  if (doc.type === 'newsHq') {
    return { type: 'newsHq', id: doc.id, name: doc.name, baseUrl: doc.baseUrl, agencies: doc.agencies ?? undefined }
  }
  return { type: 'eventRegistry', id: doc.id, name: doc.name, baseUrl: doc.baseUrl, apiKeyEnvVar: doc.apiKeyEnvVar ?? '' }
}

export async function collectForBriefItem(
  payload: Payload,
  user: User,
  cmsClient: CmsClient,
  briefItem: BriefItem,
  brief: EditorialBrief,
): Promise<{ collectedItems: CollectedItem[]; status: BriefItem['status'] }> {
  const [providersResult, channelConfigResult] = await Promise.all([
    payload.find({
      collection: 'providers',
      where: { and: [{ channels: { contains: brief.channel } }, { enabled: { equals: true } }] },
      limit: 50,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'channel-configs',
      where: { channel: { equals: brief.channel } },
      limit: 1,
      overrideAccess: true,
    }),
  ])

  const channelConfig = channelConfigResult.docs[0]
  const providerConfigs = providersResult.docs.map(toProviderConfig)

  const query: ProviderQuery = {
    channelId: brief.channel,
    language: channelConfig?.erLang ?? 'eng',
    searchQuery: briefItem.topic,
    keywordsIncluded: briefItem.keywords ?? undefined,
  }

  const { results, failures } = await collectFromProviders(providerConfigs, query)

  if (providerConfigs.length > 0 && failures.length === providerConfigs.length) {
    await payload.update({
      collection: 'brief-items',
      id: briefItem.id,
      data: { status: 'error', lastQueryRunAt: new Date().toISOString() },
      overrideAccess: false,
      user,
    })
    return { collectedItems: [], status: 'error' }
  }

  const collectedItems: CollectedItem[] = []
  for (const providerResult of results) {
    for (const item of providerResult.items) {
      const existing = await cmsClient.searchContent(item.headline, { channelId: brief.channel, limit: 1 })
      if (existing.length > 0) continue

      const doc = await payload.create({
        collection: 'collected-items',
        data: {
          briefItem: briefItem.id,
          groupKey: null,
          headline: item.headline,
          body: item.body,
          language: item.language,
          sources: [
            {
              provider: item.providerId,
              providerItemId: item.providerItemId,
              sourceUrl: item.sourceUrl,
              publishTimestamp: item.publishTimestamp,
              rawPayload: item.raw,
            },
          ],
        },
        overrideAccess: false,
        user,
      })
      collectedItems.push(doc)
    }
  }

  const status: BriefItem['status'] = collectedItems.length > 0 ? 'queried' : 'no-results'
  await payload.update({
    collection: 'brief-items',
    id: briefItem.id,
    data: { status, lastQueryRunAt: new Date().toISOString() },
    overrideAccess: false,
    user,
  })

  return { collectedItems, status }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/lib/collection/index.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/collection
git commit -m "feat: add provider collection with cms-prod dedup"
```

---

### Task 8: "Start collection" trigger on the brief review page

**Files:**
- Modify: `src/app/(dashboard)/briefs/[id]/actions.ts`
- Create: `src/app/(dashboard)/briefs/[id]/StartCollectionButton.tsx`
- Modify: `src/app/(dashboard)/briefs/[id]/page.tsx`

**Interfaces:**
- Consumes: `collectForBriefItem` (Task 7), `generatePiece` (Task 6), `getCmsClient` from `@/lib/cms-client/instance`.

- [ ] **Step 1: Add the `startCollection` action**

Append to `src/app/(dashboard)/briefs/[id]/actions.ts`:

```ts
import { getCmsClient } from '@/lib/cms-client/instance'
import { collectForBriefItem } from '@/lib/collection'
import { generatePiece } from '@/lib/generation'

export type StartCollectionState = { error: string | null; summary: string | null }

export async function startCollection(briefId: string): Promise<StartCollectionState> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  const brief = await payload.findByID({ collection: 'editorial-briefs', id: briefId, overrideAccess: false, user })
  if (brief.status !== 'confirmed') {
    return { error: 'Confirm this brief before starting collection.', summary: null }
  }

  const pendingItems = await payload.find({
    collection: 'brief-items',
    where: { and: [{ brief: { equals: briefId } }, { status: { equals: 'pending' } }] },
    limit: 100,
    overrideAccess: false,
    user,
  })

  const channelConfigResult = await payload.find({
    collection: 'channel-configs',
    where: { channel: { equals: brief.channel } },
    limit: 1,
    overrideAccess: true,
  })
  const channelConfig = channelConfigResult.docs[0] ?? null

  const cmsClient = getCmsClient()
  let collectedCount = 0
  let generatedCount = 0

  try {
    for (const briefItem of pendingItems.docs) {
      const { collectedItems } = await collectForBriefItem(payload, user, cmsClient, briefItem, brief)
      collectedCount += collectedItems.length

      for (const collectedItem of collectedItems) {
        await generatePiece(payload, user, collectedItem, briefItem, brief, channelConfig)
        generatedCount += 1
      }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Collection failed partway through.', summary: null }
  }

  revalidatePath('/')
  revalidatePath(`/briefs/${briefId}`)
  return { error: null, summary: `${collectedCount} item(s) collected, ${generatedCount} piece(s) generated.` }
}
```

- [ ] **Step 2: Write the client button**

Create `src/app/(dashboard)/briefs/[id]/StartCollectionButton.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { startCollection, type StartCollectionState } from './actions'

const initialState: StartCollectionState = { error: null, summary: null }

export function StartCollectionButton({ briefId }: { briefId: string }) {
  const [state, formAction, isPending] = useActionState<StartCollectionState, FormData>(
    () => startCollection(briefId),
    initialState,
  )

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending}>
        {isPending ? 'Collecting…' : 'Start collection'}
      </button>
      {state.error && <p className="error">{state.error}</p>}
      {state.summary && <p className="subtitle">{state.summary}</p>}
    </form>
  )
}
```

- [ ] **Step 3: Wire it into the review page**

In `src/app/(dashboard)/briefs/[id]/page.tsx`, add the import and render the button when confirmed:

```tsx
import { StartCollectionButton } from './StartCollectionButton'
```
```tsx
      <BriefItemsForm briefId={brief.id} briefStatus={brief.status} initialItems={currentItems} diffEntries={diffEntries} />
      {brief.status === 'confirmed' && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2>Collection</h2>
          <StartCollectionButton briefId={brief.id} />
        </div>
      )}
    </div>
```

- [ ] **Step 4: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Blocked by the same `CMS_BASE_URL`/`CMS_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY` environment gaps
documented for the brief-upload feature. If those become available: confirm a confirmed brief
for a channel with at least one enabled, matching `providers` doc shows the "Start collection"
button; clicking it produces the expected summary count and the generated pieces appear in the
dashboard's unclaimed queue.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/briefs/[id]/actions.ts" "src/app/(dashboard)/briefs/[id]/StartCollectionButton.tsx" "src/app/(dashboard)/briefs/[id]/page.tsx"
git commit -m "feat: add start-collection trigger to the brief review page"
```

---

### Task 9: Pre-QA hints + Publish button on the piece review page

**Files:**
- Modify: `src/app/(dashboard)/pieces/[id]/actions.ts`
- Create: `src/app/(dashboard)/pieces/[id]/PreQaHints.tsx`
- Create: `src/app/(dashboard)/pieces/[id]/PublishButton.tsx`
- Modify: `src/app/(dashboard)/pieces/[id]/page.tsx`

**Interfaces:**
- Consumes: `runPreQaChecks` (Task 5), `getCmsClient` from `@/lib/cms-client/instance`.

- [ ] **Step 1: Add the `publishPiece` action**

Append to `src/app/(dashboard)/pieces/[id]/actions.ts`:

```ts
import { getCmsClient } from '@/lib/cms-client/instance'

export async function publishPiece(pieceId: string): Promise<{ error: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    const piece = await payload.findByID({ collection: 'generated-pieces', id: pieceId, overrideAccess: false, user })

    const verdicts = await payload.find({
      collection: 'qa-verdicts',
      where: { piece: { equals: pieceId } },
      sort: '-submittedAt',
      limit: 1,
      overrideAccess: false,
      user,
    })
    if (verdicts.docs[0]?.verdict !== 'goodToGo') {
      return { error: 'This piece needs a goodToGo verdict before it can be published.' }
    }

    const blocks = (piece.currentBody ?? []) as ContentBlock[]
    const heading = blocks.find((block) => block.type === 'heading')
    const paragraphs = blocks.filter((block) => block.type === 'paragraph').map((block) => block.text)

    const result = await getCmsClient().createArticle({
      title: heading?.text ?? piece.channelName ?? piece.channel,
      paragraphs,
    })

    await payload.update({
      collection: 'generated-pieces',
      id: pieceId,
      data: { publishedAt: new Date().toISOString(), cmsPackageId: result.packageId },
      overrideAccess: false,
      user,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not publish this piece.' }
  }

  revalidatePath(`/pieces/${pieceId}`)
  return { error: null }
}
```

- [ ] **Step 2: Write the presentational hints component**

Create `src/app/(dashboard)/pieces/[id]/PreQaHints.tsx`:

```tsx
import type { PreQaResult } from '@/lib/pre-qa'

export function PreQaHints({ result }: { result: PreQaResult }) {
  return (
    <div className="card">
      <h2>Pre-QA hints</h2>

      {result.flags.length > 0 && (
        <ul className="list">
          {result.flags.map((flag, index) => (
            <li key={index} className="list-item diff-removed">
              {flag.message} (block {flag.blockId})
            </li>
          ))}
        </ul>
      )}

      <p>
        Naturalness: {result.naturalnessScore}/100 — Overall: {result.overallScore}/100
      </p>
      <p>{result.reasoning}</p>

      {result.suggestions.length > 0 && (
        <ul className="list">
          {result.suggestions.map((suggestion, index) => (
            <li key={index} className="list-item">
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write the publish button**

Create `src/app/(dashboard)/pieces/[id]/PublishButton.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { publishPiece } from './actions'

type PublishState = { error: string | null }

const initialState: PublishState = { error: null }

export function PublishButton({ pieceId }: { pieceId: string }) {
  const [state, formAction, isPending] = useActionState<PublishState, FormData>(
    () => publishPiece(pieceId),
    initialState,
  )

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending}>
        {isPending ? 'Publishing…' : 'Publish to CMS'}
      </button>
      {state.error && <p className="error">{state.error}</p>}
    </form>
  )
}
```

- [ ] **Step 4: Wire both into the review page**

Replace `src/app/(dashboard)/pieces/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { diffBlockSnapshots, type ContentBlock } from '@/lib/content-diff'
import { runPreQaChecks } from '@/lib/pre-qa'
import { ReviewForm } from './ReviewForm'
import { VerdictForm } from './VerdictForm'
import { PreQaHints } from './PreQaHints'
import { PublishButton } from './PublishButton'

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  let piece
  try {
    piece = await payload.findByID({
      collection: 'generated-pieces',
      id,
      overrideAccess: false,
      user,
    })
  } catch {
    notFound()
  }

  if (!piece) notFound()

  const generatedSnapshot = (piece.generatedSnapshot ?? []) as ContentBlock[]
  const currentBody = (piece.currentBody ?? generatedSnapshot) as ContentBlock[]
  const diffEntries = diffBlockSnapshots(generatedSnapshot, currentBody)

  const collectedItem =
    typeof piece.collectedItem === 'object'
      ? piece.collectedItem
      : await payload.findByID({ collection: 'collected-items', id: piece.collectedItem, depth: 1, overrideAccess: true })
  const briefItemForPiece =
    typeof collectedItem.briefItem === 'object'
      ? collectedItem.briefItem
      : await payload.findByID({ collection: 'brief-items', id: collectedItem.briefItem, overrideAccess: true })

  const preQaResult = await runPreQaChecks(currentBody, briefItemForPiece.bannedTerms ?? [])

  const verdicts = await payload.find({
    collection: 'qa-verdicts',
    where: { piece: { equals: piece.id } },
    sort: '-submittedAt',
    limit: 1,
    overrideAccess: false,
    user,
  })
  const canPublish = verdicts.docs[0]?.verdict === 'goodToGo' && !piece.publishedAt

  return (
    <div className="page">
      <h1>{piece.channelName ?? piece.channel}</h1>
      <p className="subtitle">{piece.attributionString}</p>

      <PreQaHints result={preQaResult} />
      <ReviewForm pieceId={piece.id} initialBlocks={currentBody} diffEntries={diffEntries} />
      <VerdictForm pieceId={piece.id} />
      {canPublish && <PublishButton pieceId={piece.id} />}
      {piece.publishedAt && <p className="subtitle">Published to CMS ({piece.cmsPackageId})</p>}
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

Blocked by the same environment gaps as Task 8. If a `GOOGLE_GENERATIVE_AI_API_KEY` becomes
available: open a generated piece's review page, confirm the Pre-QA hints card renders above
the review form with a naturalness score and any banned-term flags; submit a `goodToGo` verdict,
reload, confirm the Publish button appears; if `CMS_BASE_URL`/`CMS_API_KEY` are also available,
click it and confirm `publishedAt`/`cmsPackageId` are set and the button disappears on reload.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/pieces/[id]"
git commit -m "feat: add pre-QA hints and publish-to-cms action to the review page"
```
