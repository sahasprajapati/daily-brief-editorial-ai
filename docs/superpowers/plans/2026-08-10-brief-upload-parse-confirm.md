# Brief Upload, Parse, and Confirm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a desk lead upload a daily brief (paste/docx/pdf), have it parsed into structured topics by Gemini, review and confirm it before anything downstream can act on it, with versioning for duplicates/re-edits and a diff against the original parse — plus the missing dashboard shell (sidebar, header channel switcher, logout).

**Architecture:** Extends the existing Payload collections (`editorial-briefs`, `brief-items` already have almost the right shape) with a `leadOfDesks` permission on `Users` and a new `brief-files` upload collection. Parsing is a synchronous server action calling Gemini via the already-installed `ai` SDK (no job queue exists in this codebase, so extraction happens inline and the request waits for it). The confirm gate is enforced by a `beforeChange` hook on `brief-items`, not just the UI. `/login` moves into its own route group so the new authenticated shell (Sidebar/Header) in `(dashboard)/layout.tsx` doesn't wrap it and cause a redirect loop.

**Tech Stack:** Next.js 15 App Router, React 19 Server Actions, Payload 3 Local API, `ai` + `@ai-sdk/google` (Gemini `generateObject`), `zod`, `mammoth` (docx text), `unpdf` (pdf text), `bun:test`.

## Global Constraints

- No local `channels` collection — desk data is always fetched live via `src/lib/cms-client`'s `listChannels()`, per this codebase's existing rule that channel/desk identity is never a local relationship (see the comment in `src/payload/collections/editorial-briefs/index.ts`).
- Every Local API call from a server action or an `Access`/hook function that should be subject to access control MUST pass `overrideAccess: false` plus the acting `user` (mutations) or `overrideAccess: true` for internal lookups *inside* an access-control check (to avoid recursing into the same check) — same rule as the previous plan, still load-bearing here.
- `CMS_BASE_URL`/`CMS_API_KEY` are placeholder/unset in `.env` in this dev environment — any code that calls `listChannels()` MUST tolerate that call failing (network error to an unreachable placeholder domain) without crashing the page. Every desk-list helper wraps the call in try/catch and returns `[]` on failure.
- `qa-verdicts.okfVersion` and the `'manual'` constant convention from the previous feature are unrelated to this one — not touched here.
- Path aliases: `@/*` → `./src/*`, `@payload-config` → `./src/payload.config.ts`.
- New dependencies to add: `zod`, `mammoth`, `unpdf` (via `bun add`).

---

## File Structure

```
src/payload/collections/users/index.ts            (modify) - add leadOfDesks field
src/payload/access/admin.ts                        (modify) - add isLeadOfDesk + 4 Access fns
src/payload/access/admin.test.ts                   (modify) - tests for the above

src/payload/collections/brief-files/index.ts        (create) - upload collection
src/payload/collections/editorial-briefs/index.ts    (modify) - add sourceType/sourceFile/rawText,
                                                                 wire access
src/payload/collections/brief-items/index.ts         (modify) - wire access, add hook
src/payload/collections/brief-items/hooks/assertBriefConfirmed.ts   (create)
src/payload/collections/brief-items/hooks/assertBriefConfirmed.test.ts (create)
src/payload.config.ts                                (modify) - register BriefFiles

src/lib/cms-client/instance.ts                       (create) - getCmsClient() singleton
src/lib/desks.ts                                     (create) - getLeadDesks/getSwitcherDesks
src/lib/desks.test.ts                                (create)

src/lib/brief-extraction/text-extraction.ts          (create) - docx/pdf -> text
src/lib/brief-extraction/schema.ts                   (create) - zod extraction schema
src/lib/brief-extraction/gemini.ts                   (create) - runExtraction()
src/lib/brief-extraction/index.ts                    (create) - extractBrief(), EmptyBriefError
src/lib/brief-extraction/index.test.ts                (create)

src/lib/brief-diff/index.ts                          (create) - diffBriefItems()
src/lib/brief-diff/index.test.ts                     (create)

src/lib/briefs/create-items.ts                       (create) - createBriefItems()
src/lib/briefs/versioning.ts                         (create) - createNextBriefVersion()
src/lib/briefs/versioning.test.ts                     (create)

src/payload/auth/session.ts                          (modify) - wrap getCurrentUser in React cache()

src/app/globals.css                                  (create, moved from (dashboard)/globals.css)
src/app/(auth)/layout.tsx                             (create)
src/app/(auth)/login/page.tsx                         (moved from (dashboard)/login/page.tsx)
src/app/(auth)/login/actions.ts                       (moved from (dashboard)/login/actions.ts)

src/app/(dashboard)/layout.tsx                        (modify) - add Sidebar/Header shell
src/app/(dashboard)/Sidebar.tsx                       (create)
src/app/(dashboard)/Header.tsx                        (create)
src/app/(dashboard)/ChannelSwitcher.tsx               (create)
src/app/(dashboard)/LogoutButton.tsx                  (create)
src/app/(dashboard)/shell-actions.ts                  (create) - setSelectedChannel(), logout()
src/app/(dashboard)/page.tsx                          (modify) - scope queries by selected channel

src/app/(dashboard)/briefs/page.tsx                   (create) - briefs list
src/app/(dashboard)/briefs/new/page.tsx               (create) - upload screen
src/app/(dashboard)/briefs/new/UploadForm.tsx         (create)
src/app/(dashboard)/briefs/new/actions.ts             (create) - uploadBrief()
src/app/(dashboard)/briefs/[id]/page.tsx              (create) - review/confirm screen
src/app/(dashboard)/briefs/[id]/BriefItemsForm.tsx    (create)
src/app/(dashboard)/briefs/[id]/actions.ts            (create) - saveBriefItems(), confirmBrief()
```

---

### Task 1: `leadOfDesks` field + `isLeadOfDesk` access helper

**Files:**
- Modify: `src/payload/collections/users/index.ts`
- Modify: `src/payload/access/admin.ts`
- Modify: `src/payload/access/admin.test.ts`

**Interfaces:**
- Consumes: `User` from `@/payload-types` (will gain `leadOfDesks?: string[] | null` after `generate:types`).
- Produces (used by Tasks 3, 5, 10, 12): `isLeadOfDesk(user: User | null, channelId: unknown): boolean`, and four new `Access` functions: `leadOfDeskBriefCreate`, `leadOfDeskBriefUpdate`, `leadOfDeskBriefItemUpdate`, `leadOfDeskFileCreate`.

- [ ] **Step 1: Add the field to Users**

In `src/payload/collections/users/index.ts`, add to `fields` (after `role`):

```ts
    {
      name: 'leadOfDesks',
      type: 'text',
      hasMany: true,
      admin: { description: 'External cms-prod channel ids this user leads. Empty = leads nothing.' },
    },
```

- [ ] **Step 2: Write the failing tests for `isLeadOfDesk`**

Append to `src/payload/access/admin.test.ts` (new `describe` block, after the existing ones):

```ts
import { isLeadOfDesk, leadOfDeskBriefCreate, leadOfDeskBriefUpdate, leadOfDeskBriefItemUpdate, leadOfDeskFileCreate } from './admin'

describe('isLeadOfDesk', () => {
  test('true when the channel id is in leadOfDesks', () => {
    const user = { id: 'u1', role: 'editor', leadOfDesks: ['ch-1', 'ch-2'] } as User
    expect(isLeadOfDesk(user, 'ch-1')).toBe(true)
  })

  test('false when the channel id is not in leadOfDesks', () => {
    const user = { id: 'u1', role: 'editor', leadOfDesks: ['ch-2'] } as User
    expect(isLeadOfDesk(user, 'ch-1')).toBe(false)
  })

  test('false when leadOfDesks is empty or missing', () => {
    expect(isLeadOfDesk({ id: 'u1', role: 'editor' } as User, 'ch-1')).toBe(false)
    expect(isLeadOfDesk(null, 'ch-1')).toBe(false)
  })

  test('false when channelId is not a string', () => {
    const user = { id: 'u1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    expect(isLeadOfDesk(user, undefined)).toBe(false)
  })
})

describe('leadOfDeskBriefCreate', () => {
  test('admin can create for any channel', () => {
    const req = { user: admin } as PayloadRequest
    expect(leadOfDeskBriefCreate({ req, data: { channel: 'ch-99' } } as any)).toBe(true)
  })

  test('lead of the target desk can create', () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead } as PayloadRequest
    expect(leadOfDeskBriefCreate({ req, data: { channel: 'ch-1' } } as any)).toBe(true)
  })

  test('non-lead of the target desk cannot create', () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2 } as PayloadRequest
    expect(leadOfDeskBriefCreate({ req, data: { channel: 'ch-1' } } as any)).toBe(false)
  })
})

function fakeFindByIDChannel(channel: string) {
  return async () => ({ id: 'brief-1', channel } as any)
}

describe('leadOfDeskBriefUpdate', () => {
  test('admin can update any brief', async () => {
    const req = { user: admin, payload: { findByID: fakeFindByIDChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefUpdate({ req, id: 'brief-1' } as any)).toBe(true)
  })

  test('lead of the brief channel can update', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead, payload: { findByID: fakeFindByIDChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefUpdate({ req, id: 'brief-1' } as any)).toBe(true)
  })

  test('non-lead cannot update', async () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2, payload: { findByID: fakeFindByIDChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefUpdate({ req, id: 'brief-1' } as any)).toBe(false)
  })
})

function fakeFindByIDBriefChannel(channel: string) {
  return async () => ({ id: 'item-1', brief: { channel } } as any)
}

describe('leadOfDeskBriefItemUpdate', () => {
  test('lead of the parent brief channel can update the item', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead, payload: { findByID: fakeFindByIDBriefChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefItemUpdate({ req, id: 'item-1' } as any)).toBe(true)
  })

  test('non-lead cannot update the item', async () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2, payload: { findByID: fakeFindByIDBriefChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefItemUpdate({ req, id: 'item-1' } as any)).toBe(false)
  })
})

describe('leadOfDeskFileCreate', () => {
  test('lead of the target desk can upload a file for it', () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead } as PayloadRequest
    expect(leadOfDeskFileCreate({ req, data: { channel: 'ch-1' } } as any)).toBe(true)
  })

  test('non-lead cannot upload a file for a desk they do not lead', () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2 } as PayloadRequest
    expect(leadOfDeskFileCreate({ req, data: { channel: 'ch-1' } } as any)).toBe(false)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test src/payload/access/admin.test.ts`
Expected: FAIL — the new exports don't exist yet.

- [ ] **Step 4: Implement `isLeadOfDesk` and the four Access functions**

Append to `src/payload/access/admin.ts`:

```ts
/** A user leads a desk if its external channel id is in their leadOfDesks list - independent
 *  of role: an 'editor' can also be a lead of specific desks, there's no separate 'lead' role. */
export const isLeadOfDesk = (user: User | null, channelId: unknown): boolean =>
  typeof channelId === 'string' && (user?.leadOfDesks ?? []).includes(channelId)

export const leadOfDeskBriefCreate: Access = ({ req: { user }, data }) => {
  const typedUser = user as User | null
  if (checkIsAdmin(typedUser)) return true
  return isLeadOfDesk(typedUser, data?.channel)
}

export const leadOfDeskBriefUpdate: Access = async ({ req, id }) => {
  const typedUser = req.user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!id) return false
  const brief = await req.payload.findByID({ collection: 'editorial-briefs', id, depth: 0, overrideAccess: true })
  return isLeadOfDesk(typedUser, brief?.channel)
}

export const leadOfDeskBriefItemUpdate: Access = async ({ req, id }) => {
  const typedUser = req.user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!id) return false
  const item = await req.payload.findByID({ collection: 'brief-items', id, depth: 1, overrideAccess: true })
  const channel = typeof item?.brief === 'object' ? item.brief.channel : undefined
  return isLeadOfDesk(typedUser, channel)
}

export const leadOfDeskFileCreate: Access = ({ req: { user }, data }) => {
  const typedUser = user as User | null
  if (checkIsAdmin(typedUser)) return true
  return isLeadOfDesk(typedUser, data?.channel)
}
```

Note `leadOfDeskBriefItemUpdate` uses `depth: 1` deliberately (not `0`) — it needs `item.brief.channel`, one level deeper than the item itself, so the lookup must populate the `brief` relationship. Compare with `leadOfDeskBriefUpdate`, which needs only the brief's own `channel` field and correctly uses `depth: 0`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/payload/access/admin.test.ts`
Expected: PASS, all tests (13 previous + new ones).

- [ ] **Step 6: Type-check**

Run: `bun run check-types`
Expected: no new errors (the pre-existing `bun:test` module errors are unrelated baseline noise).

- [ ] **Step 7: Commit**

```bash
git add src/payload/collections/users/index.ts src/payload/access/admin.ts src/payload/access/admin.test.ts
git commit -m "feat: add per-desk lead permission and access checks"
```

---

### Task 2: `brief-files` upload collection + `editorial-briefs` new fields

**Files:**
- Create: `src/payload/collections/brief-files/index.ts`
- Modify: `src/payload/collections/editorial-briefs/index.ts`
- Modify: `src/payload.config.ts`

**Interfaces:**
- Produces: `brief-files` collection (slug `brief-files`), `editorial-briefs.sourceType: 'paste'|'docx'|'pdf'`, `editorial-briefs.sourceFile: relationship to brief-files`, `editorial-briefs.rawText: string`. After `generate:types`, `BriefFile` and the updated `EditorialBrief` types exist in `@/payload-types`.

- [ ] **Step 1: Create the brief-files collection**

Create `src/payload/collections/brief-files/index.ts`:

```ts
import type { CollectionConfig } from 'payload'
import { adminOnly, leadOfDeskFileCreate } from '../../access/admin'

/** Stores the original uploaded .docx/.pdf for a brief, for audit - local disk storage, no
 *  S3/cloud adapter configured anywhere in this app. `channel` here is only used by the create
 *  access check (leadOfDeskFileCreate); it is not otherwise read back. */
export const BriefFiles: CollectionConfig = {
  slug: 'brief-files',
  admin: {
    useAsTitle: 'filename',
  },
  access: {
    read: () => true,
    create: leadOfDeskFileCreate,
    update: adminOnly,
    delete: adminOnly,
  },
  upload: {
    staticDir: 'brief-files',
    mimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  fields: [{ name: 'channel', type: 'text', required: true, index: true }],
  timestamps: true,
}
```

- [ ] **Step 2: Add the new fields to editorial-briefs**

In `src/payload/collections/editorial-briefs/index.ts`, add to `fields` (after `channelName`):

```ts
    {
      name: 'sourceType',
      type: 'select',
      required: true,
      options: ['paste', 'docx', 'pdf'],
    },
    {
      name: 'sourceFile',
      type: 'relationship',
      relationTo: 'brief-files',
      admin: { description: 'Null when sourceType is paste.' },
    },
    {
      name: 'rawText',
      type: 'textarea',
      required: true,
      admin: { description: 'The exact text that was parsed - pasted directly, or extracted from sourceFile.' },
    },
```

- [ ] **Step 3: Register the collection**

In `src/payload.config.ts`, add the import and list entry:

```ts
import { BriefFiles } from './payload/collections/brief-files'
```

```ts
  collections: [
    Users,
    EditorialBriefs,
    BriefItems,
    Providers,
    CollectedItems,
    GeneratedPieces,
    PieceAssignments,
    QaVerdicts,
    BriefFiles,
  ],
```

- [ ] **Step 4: Regenerate types and type-check**

Run: `bun run generate:types`
Expected: succeeds, `src/payload-types.ts` now has a `BriefFile` interface and `EditorialBrief` gains `sourceType`/`sourceFile`/`rawText`.

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/payload/collections/brief-files src/payload/collections/editorial-briefs/index.ts src/payload.config.ts src/payload-types.ts
git commit -m "feat: add brief-files upload collection and editorial-briefs source fields"
```

---

### Task 3: Wire lead-of-desk access control

**Files:**
- Modify: `src/payload/collections/editorial-briefs/index.ts`
- Modify: `src/payload/collections/brief-items/index.ts`

**Interfaces:**
- Consumes: `leadOfDeskBriefCreate`, `leadOfDeskBriefUpdate`, `leadOfDeskBriefItemUpdate` from `../../access/admin` (Task 1).

- [ ] **Step 1: Update editorial-briefs access**

In `src/payload/collections/editorial-briefs/index.ts`:

```ts
import { adminOnly, leadOfDeskBriefCreate, leadOfDeskBriefUpdate } from '../../access/admin'
```

```ts
  access: {
    read: () => true,
    create: leadOfDeskBriefCreate,
    update: leadOfDeskBriefUpdate,
    delete: adminOnly,
  },
```

- [ ] **Step 2: Update brief-items access**

In `src/payload/collections/brief-items/index.ts`:

```ts
import { adminOnly, leadOfDeskBriefItemUpdate } from '../../access/admin'
```

```ts
  access: {
    read: () => true,
    create: adminOnly,
    update: leadOfDeskBriefItemUpdate,
    delete: adminOnly,
  },
```

`create` stays `adminOnly` here deliberately — `brief-items` rows are only ever created
programmatically by the parse/versioning flow (Tasks 9, 11), acting through the parent brief's
own `leadOfDeskBriefCreate` check, never directly by a client request naming a `brief-items`
document.

- [ ] **Step 3: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/payload/collections/editorial-briefs/index.ts src/payload/collections/brief-items/index.ts
git commit -m "feat: wire lead-of-desk access control into briefs and brief-items"
```

---

### Task 4: Confirm gate — `assertBriefConfirmed` hook

**Files:**
- Create: `src/payload/collections/brief-items/hooks/assertBriefConfirmed.ts`
- Test: `src/payload/collections/brief-items/hooks/assertBriefConfirmed.test.ts`
- Modify: `src/payload/collections/brief-items/index.ts`

**Interfaces:**
- Produces: `assertBriefConfirmed: CollectionBeforeChangeHook<BriefItem>`, wired into `brief-items.hooks.beforeChange`.

- [ ] **Step 1: Write the failing test**

Create `src/payload/collections/brief-items/hooks/assertBriefConfirmed.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import type { PayloadRequest } from 'payload'
import { assertBriefConfirmed } from './assertBriefConfirmed'

function fakeReq(briefStatus: string): PayloadRequest {
  return {
    payload: {
      findByID: async () => ({ id: 'brief-1', status: briefStatus }),
    },
  } as unknown as PayloadRequest
}

describe('assertBriefConfirmed', () => {
  test('allows create operations unconditionally', async () => {
    const result = await assertBriefConfirmed({
      req: fakeReq('parsed'),
      operation: 'create',
      data: { status: 'pending', brief: 'brief-1' },
    } as any)
    expect(result).toEqual({ status: 'pending', brief: 'brief-1' })
  })

  test('allows an update that does not touch status', async () => {
    const data = { topic: 'Updated topic' }
    const result = await assertBriefConfirmed({
      req: fakeReq('parsed'),
      operation: 'update',
      data,
      originalDoc: { status: 'pending', brief: 'brief-1' },
    } as any)
    expect(result).toBe(data)
  })

  test('allows an update when the original item was not pending', async () => {
    const data = { status: 'queried' }
    const result = await assertBriefConfirmed({
      req: fakeReq('parsed'),
      operation: 'update',
      data,
      originalDoc: { status: 'queried', brief: 'brief-1' },
    } as any)
    expect(result).toBe(data)
  })

  test('blocks moving status off pending when the parent brief is not confirmed', async () => {
    const promise = assertBriefConfirmed({
      req: fakeReq('parsed'),
      operation: 'update',
      data: { status: 'queried' },
      originalDoc: { status: 'pending', brief: 'brief-1' },
    } as any)
    await expect(promise).rejects.toThrow('Cannot advance a brief item before its brief is confirmed')
  })

  test('allows moving status off pending when the parent brief is confirmed', async () => {
    const data = { status: 'queried' }
    const result = await assertBriefConfirmed({
      req: fakeReq('confirmed'),
      operation: 'update',
      data,
      originalDoc: { status: 'pending', brief: 'brief-1' },
    } as any)
    expect(result).toBe(data)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/payload/collections/brief-items/hooks/assertBriefConfirmed.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the hook**

Create `src/payload/collections/brief-items/hooks/assertBriefConfirmed.ts`:

```ts
import { APIError } from 'payload'
import type { CollectionBeforeChangeHook } from 'payload'
import type { BriefItem } from '@/payload-types'

/** Data-layer half of the confirm gate: no code in this app triggers provider collection yet,
 *  but whatever eventually does must go through a brief-items status change, and this hook
 *  blocks that change until the parent brief is confirmed - the gate can't be bypassed by
 *  skipping a UI step, per the spec's "not skippable" requirement. */
export const assertBriefConfirmed: CollectionBeforeChangeHook<BriefItem> = async ({
  req,
  data,
  originalDoc,
  operation,
}) => {
  if (operation !== 'update') return data
  if (originalDoc.status !== 'pending' || data?.status === undefined || data.status === 'pending') return data

  const brief = await req.payload.findByID({
    collection: 'editorial-briefs',
    id: originalDoc.brief as string,
    depth: 0,
    overrideAccess: true,
  })

  if (brief.status !== 'confirmed') {
    throw new APIError('Cannot advance a brief item before its brief is confirmed', 400)
  }

  return data
}
```

- [ ] **Step 4: Wire the hook into brief-items**

In `src/payload/collections/brief-items/index.ts`, add:

```ts
import { assertBriefConfirmed } from './hooks/assertBriefConfirmed'
```

```ts
  hooks: {
    beforeChange: [assertBriefConfirmed],
  },
```

(add this block after the `access` block, same position `piece-assignments/index.ts` uses for its own `hooks`).

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test src/payload/collections/brief-items/hooks/assertBriefConfirmed.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 6: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/payload/collections/brief-items
git commit -m "feat: enforce brief-confirmation gate at the data layer"
```

---

### Task 5: `cms-client` instance + desk-list helpers

**Files:**
- Create: `src/lib/cms-client/instance.ts`
- Create: `src/lib/desks.ts`
- Test: `src/lib/desks.test.ts`

**Interfaces:**
- Consumes: `createCmsClient` from `./client` (existing), `User` from `@/payload-types`.
- Produces (used by Tasks 10, 11, 12): `getCmsClient(): CmsClient`, `getLeadDesks(user: User): Promise<Desk[]>`, `getSwitcherDesks(user: User): Promise<Desk[]>`, `interface Desk { id: string; name: string }`.

- [ ] **Step 1: Write the cms-client singleton**

Create `src/lib/cms-client/instance.ts`:

```ts
import { createCmsClient, type CmsClient } from './client'

let instance: CmsClient | undefined

export function getCmsClient(): CmsClient {
  if (!instance) {
    instance = createCmsClient({
      baseUrl: process.env.CMS_BASE_URL || '',
      apiKey: process.env.CMS_API_KEY || '',
    })
  }
  return instance
}
```

- [ ] **Step 2: Write the failing tests for the desk helpers**

Create `src/lib/desks.test.ts`:

```ts
import { describe, expect, mock, test } from 'bun:test'
import type { User } from '@/payload-types'

const listChannels = mock(async () => [
  { id: 'ch-1', name: 'TRT World', languageCode: 'en', language: 'English' },
  { id: 'ch-2', name: 'TRT Arabi', languageCode: 'ar', language: 'Arabic' },
])

mock.module('./cms-client/instance', () => ({
  getCmsClient: () => ({ listChannels }),
}))

const { getLeadDesks, getSwitcherDesks } = await import('./desks')

const admin = { id: 'admin-1', role: 'admin' } as User
const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
const plainEditor = { id: 'editor-1', role: 'editor' } as User

describe('getLeadDesks', () => {
  test('admin sees every channel', async () => {
    const desks = await getLeadDesks(admin)
    expect(desks.map((d) => d.id)).toEqual(['ch-1', 'ch-2'])
  })

  test('a lead sees only the channels they lead', async () => {
    const desks = await getLeadDesks(lead)
    expect(desks.map((d) => d.id)).toEqual(['ch-1'])
  })

  test('a plain editor with no leadOfDesks sees nothing', async () => {
    const desks = await getLeadDesks(plainEditor)
    expect(desks).toEqual([])
  })
})

describe('getSwitcherDesks', () => {
  test('admin sees every channel', async () => {
    const desks = await getSwitcherDesks(admin)
    expect(desks.map((d) => d.id)).toEqual(['ch-1', 'ch-2'])
  })

  test('a lead sees only the channels they lead', async () => {
    const desks = await getSwitcherDesks(lead)
    expect(desks.map((d) => d.id)).toEqual(['ch-1'])
  })

  test('a plain editor with no leadOfDesks sees every channel', async () => {
    const desks = await getSwitcherDesks(plainEditor)
    expect(desks.map((d) => d.id)).toEqual(['ch-1', 'ch-2'])
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test src/lib/desks.test.ts`
Expected: FAIL — `./desks` doesn't exist.

- [ ] **Step 4: Implement the desk helpers**

Create `src/lib/desks.ts`:

```ts
import { getCmsClient } from './cms-client/instance'
import type { User } from '@/payload-types'

export interface Desk {
  id: string
  name: string
}

/** CMS_BASE_URL/CMS_API_KEY may be unset or unreachable (e.g. in local dev before real
 *  cms-prod credentials are configured) - every caller must be able to render around an
 *  empty desk list rather than crash the page. */
async function fetchChannelsSafely(): Promise<Desk[]> {
  try {
    return await getCmsClient().listChannels()
  } catch {
    return []
  }
}

/** Desks this user may upload/confirm briefs for: admins get everything, everyone else only
 *  the desks in their own leadOfDesks - independent of role, there's no separate 'lead' role. */
export async function getLeadDesks(user: User): Promise<Desk[]> {
  const channels = await fetchChannelsSafely()
  if (user.role === 'admin') return channels
  const leadOfDesks = user.leadOfDesks ?? []
  return channels.filter((channel) => leadOfDesks.includes(channel.id))
}

/** Desks this user may pick in the header channel switcher: a lead (non-empty leadOfDesks) is
 *  restricted to their own desks, matching the upload gate; everyone else (admin, or a plain
 *  editor with no lead assignments) sees the full list. */
export async function getSwitcherDesks(user: User): Promise<Desk[]> {
  const channels = await fetchChannelsSafely()
  if (user.role === 'admin') return channels
  const leadOfDesks = user.leadOfDesks ?? []
  if (leadOfDesks.length > 0) return channels.filter((channel) => leadOfDesks.includes(channel.id))
  return channels
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/lib/desks.test.ts`
Expected: PASS, all 6 tests.

- [ ] **Step 6: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cms-client/instance.ts src/lib/desks.ts src/lib/desks.test.ts
git commit -m "feat: add cms-client instance and desk-list helpers"
```

---

### Task 6: Text extraction (docx/pdf → text)

**Files:**
- Create: `src/lib/brief-extraction/text-extraction.ts`

**Interfaces:**
- Produces (used by Task 11): `extractTextFromDocx(buffer: Buffer): Promise<string>`, `extractTextFromPdf(buffer: Buffer): Promise<string>`.

No automated test for this task — both functions are two-line wrappers around a single call into
a third-party parsing library (`mammoth`, `unpdf`); the thing worth verifying is real-file
behavior, which needs an actual `.docx`/`.pdf` binary fixture. That's covered by this task's
manual verification step (upload a real file through the browser in Task 11) rather than a unit
test against a fabricated buffer, which wouldn't catch anything a type-checker doesn't already.

- [ ] **Step 1: Add the dependencies**

Run: `bun add mammoth unpdf zod`

- [ ] **Step 2: Write the extraction functions**

Create `src/lib/brief-extraction/text-extraction.ts`:

```ts
import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value.trim()
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  return text.trim()
}
```

- [ ] **Step 3: Type-check**

Run: `bun run check-types`
Expected: no new errors. If `mammoth` or `unpdf` ship without bundled types, this step will
surface it — install `@types/mammoth` if TypeScript can't find `mammoth`'s types (unpdf ships
its own).

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock src/lib/brief-extraction/text-extraction.ts
git commit -m "feat: add docx/pdf text extraction"
```

---

### Task 7: Brief extraction via Gemini

**Files:**
- Create: `src/lib/brief-extraction/schema.ts`
- Create: `src/lib/brief-extraction/gemini.ts`
- Create: `src/lib/brief-extraction/index.ts`
- Test: `src/lib/brief-extraction/index.test.ts`

**Interfaces:**
- Consumes: `generateObject` from `ai`, `google` from `@ai-sdk/google`, `z` from `zod`.
- Produces (used by Task 11): `extractBrief(rawText: string): Promise<ExtractedBriefItem[]>`, `class EmptyBriefError extends Error`, `type ExtractedBriefItem`.

- [ ] **Step 1: Write the extraction schema**

Create `src/lib/brief-extraction/schema.ts`:

```ts
import { z } from 'zod'

export const extractedBriefItemSchema = z.object({
  topic: z.string(),
  keywords: z.array(z.string()).default([]),
  angle: z.string(),
  priorityOrder: z.number(),
  region: z.string().optional(),
  exclusions: z.array(z.string()).default([]),
  sentiment: z.string().optional(),
  portrayalNotes: z.string().optional(),
  bannedTerms: z.array(z.string()).default([]),
  requiredContext: z.string().optional(),
})

export const extractedBriefSchema = z.object({
  items: z.array(extractedBriefItemSchema),
})

export type ExtractedBriefItem = z.infer<typeof extractedBriefItemSchema>
export type ExtractedBrief = z.infer<typeof extractedBriefSchema>
```

- [ ] **Step 2: Write the Gemini call wrapper**

Create `src/lib/brief-extraction/gemini.ts`:

```ts
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { extractedBriefSchema, type ExtractedBrief } from './schema'

/** Adapted from the proven prompt in trt-editorial-n8n/trt-daily-editorial.json's "Extract
 *  Brief" node - extended to also ask for priorityOrder, region, and exclusions per topic,
 *  which that prototype didn't extract but this app's brief-items schema requires. */
const SYSTEM_PROMPT = `You are extracting structured data from a TRT newsroom morning editorial brief.
Each topic must be a distinct news story. Each news_item.topic must exactly match its own topic
consistently across all extracted fields for that story.
For each topic, infer:
- keywords: search terms for finding related coverage
- angle: how this story should be covered
- priorityOrder: 1 = highest priority, based on any stated priority ordering or emphasis in the
  text (e.g. "lead with X"), otherwise the order the topic is mentioned
- region: a specific geographic focus, if one is implied by the text
- exclusions: angles or sub-topics the text explicitly says to leave uncovered
- sentiment: the tone/stance to take
- portrayalNotes: guidance on how to portray people/events in this story
- bannedTerms: specific words or phrases the piece must not use
- requiredContext: facts or figures that must be included`

export async function runExtraction(rawText: string): Promise<ExtractedBrief> {
  const { object } = await generateObject({
    model: google('gemini-2.0-flash'),
    schema: extractedBriefSchema,
    system: SYSTEM_PROMPT,
    prompt: rawText,
  })
  return object
}
```

- [ ] **Step 3: Write the failing tests for `extractBrief`**

Create `src/lib/brief-extraction/index.test.ts`:

```ts
import { describe, expect, spyOn, test } from 'bun:test'
import * as gemini from './gemini'
import { EmptyBriefError, extractBrief } from './index'

describe('extractBrief', () => {
  test('returns the extracted items on success', async () => {
    const items = [
      {
        topic: 'Gaza ceasefire talks',
        keywords: ['Gaza', 'ceasefire'],
        angle: 'Focus on the mediation effort',
        priorityOrder: 1,
        region: 'Middle East',
        exclusions: [],
        sentiment: 'sympathetic',
        portrayalNotes: 'Avoid euphemisms',
        bannedTerms: [],
        requiredContext: 'Current death toll',
      },
    ]
    spyOn(gemini, 'runExtraction').mockResolvedValue({ items })

    const result = await extractBrief('some raw brief text')

    expect(result).toEqual(items)
  })

  test('throws EmptyBriefError and persists nothing when zero topics are extracted', async () => {
    spyOn(gemini, 'runExtraction').mockResolvedValue({ items: [] })

    await expect(extractBrief('empty text')).rejects.toThrow(EmptyBriefError)
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `bun test src/lib/brief-extraction/index.test.ts`
Expected: FAIL — `./index` doesn't exist.

- [ ] **Step 5: Implement `extractBrief`**

Create `src/lib/brief-extraction/index.ts`:

```ts
import { runExtraction } from './gemini'
import type { ExtractedBriefItem } from './schema'

export class EmptyBriefError extends Error {
  constructor() {
    super('No topics found in this brief.')
    this.name = 'EmptyBriefError'
  }
}

export async function extractBrief(rawText: string): Promise<ExtractedBriefItem[]> {
  const result = await runExtraction(rawText)
  if (result.items.length === 0) {
    throw new EmptyBriefError()
  }
  return result.items
}

export type { ExtractedBrief, ExtractedBriefItem } from './schema'
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test src/lib/brief-extraction/index.test.ts`
Expected: PASS, both tests.

- [ ] **Step 7: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/brief-extraction
git commit -m "feat: add Gemini-based brief extraction with zero-topic rejection"
```

---

### Task 8: Structural brief-item diff

**Files:**
- Create: `src/lib/brief-diff/index.ts`
- Test: `src/lib/brief-diff/index.test.ts`

**Interfaces:**
- Produces (used by Task 12): `diffBriefItems(original: DiffableBriefItem[], current: DiffableBriefItem[]): BriefItemDiffEntry[]`, `interface DiffableBriefItem`, `interface BriefItemDiffEntry`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/brief-diff/index.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { diffBriefItems } from './index'

describe('diffBriefItems', () => {
  test('marks a topic unchanged when no compared field differs', () => {
    const item = { topic: 'Gaza ceasefire', angle: 'Focus on mediation', priorityOrder: 1 }
    const result = diffBriefItems([item], [{ ...item }])
    expect(result).toEqual([{ topic: 'Gaza ceasefire', status: 'unchanged', fieldChanges: {} }])
  })

  test('marks a topic changed and reports the field diff', () => {
    const original = [{ topic: 'Gaza ceasefire', angle: 'Original angle', priorityOrder: 1 }]
    const current = [{ topic: 'Gaza ceasefire', angle: 'Edited angle', priorityOrder: 2 }]
    const result = diffBriefItems(original, current)
    expect(result).toEqual([
      {
        topic: 'Gaza ceasefire',
        status: 'changed',
        fieldChanges: {
          angle: { before: 'Original angle', after: 'Edited angle' },
          priorityOrder: { before: 1, after: 2 },
        },
      },
    ])
  })

  test('marks a new topic as added', () => {
    const result = diffBriefItems([], [{ topic: 'New topic', angle: 'An angle', priorityOrder: 1 }])
    expect(result).toEqual([{ topic: 'New topic', status: 'added', fieldChanges: {} }])
  })

  test('marks a removed topic as removed', () => {
    const result = diffBriefItems([{ topic: 'Old topic', angle: 'An angle', priorityOrder: 1 }], [])
    expect(result).toEqual([{ topic: 'Old topic', status: 'removed', fieldChanges: {} }])
  })

  test('compares array fields by value, not reference', () => {
    const original = [{ topic: 'T', angle: 'A', priorityOrder: 1, exclusions: ['x', 'y'] }]
    const current = [{ topic: 'T', angle: 'A', priorityOrder: 1, exclusions: ['x', 'y'] }]
    const result = diffBriefItems(original, current)
    expect(result[0].status).toBe('unchanged')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/lib/brief-diff/index.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `diffBriefItems`**

Create `src/lib/brief-diff/index.ts`:

```ts
export interface DiffableBriefItem {
  topic: string
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/lib/brief-diff/index.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/brief-diff
git commit -m "feat: add structural brief-item diff"
```

---

### Task 9: Shared brief creation/versioning helpers

**Files:**
- Create: `src/lib/briefs/create-items.ts`
- Create: `src/lib/briefs/versioning.ts`
- Test: `src/lib/briefs/versioning.test.ts`

**Interfaces:**
- Consumes: `ExtractedBriefItem` from `@/lib/brief-extraction`, `EditorialBrief`/`User` from `@/payload-types`.
- Produces (used by Tasks 11, 12): `createBriefItems(payload, user, briefId, items): Promise<void>`, `createNextBriefVersion(input: NewVersionInput): Promise<EditorialBrief>`.

- [ ] **Step 1: Write `createBriefItems`**

Create `src/lib/briefs/create-items.ts`:

```ts
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import type { ExtractedBriefItem } from '@/lib/brief-extraction'

export async function createBriefItems(
  payload: Payload,
  user: User,
  briefId: string,
  items: ExtractedBriefItem[],
): Promise<void> {
  for (const item of items) {
    await payload.create({
      collection: 'brief-items',
      data: { brief: briefId, status: 'pending', ...item },
      overrideAccess: false,
      user,
    })
  }
}
```

- [ ] **Step 2: Write the failing test for `createNextBriefVersion`**

Create `src/lib/briefs/versioning.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import type { EditorialBrief, User } from '@/payload-types'
import { createNextBriefVersion } from './versioning'

function fakePayload() {
  const calls: { collection: string; op: string; data: any; id?: string }[] = []
  return {
    calls,
    payload: {
      update: async ({ collection, id, data }: any) => {
        calls.push({ collection, op: 'update', id, data })
        return { id, ...data }
      },
      create: async ({ collection, data }: any) => {
        calls.push({ collection, op: 'create', data })
        return { id: `${collection}-new`, ...data }
      },
    },
  }
}

const user = { id: 'lead-1', role: 'editor' } as User
const previous = { id: 'brief-1', channel: 'ch-1', version: 1, status: 'confirmed' } as EditorialBrief

describe('createNextBriefVersion', () => {
  test('supersedes the previous brief and creates a new parsed draft with the next version number', async () => {
    const { payload, calls } = fakePayload()

    const result = await createNextBriefVersion({
      payload: payload as any,
      user,
      previous,
      items: [{ topic: 'T', keywords: [], angle: 'A', priorityOrder: 1, exclusions: [], bannedTerms: [] } as any],
      rawParseSnapshot: [{ topic: 'T' }],
      sourceType: 'paste',
      rawText: 'raw text',
      title: 'Brief title',
    })

    expect(calls[0]).toMatchObject({ collection: 'editorial-briefs', op: 'update', id: 'brief-1', data: { status: 'superseded' } })
    expect(calls[1]).toMatchObject({
      collection: 'editorial-briefs',
      op: 'create',
      data: { channel: 'ch-1', status: 'parsed', version: 2, previousVersion: 'brief-1' },
    })
    expect(calls[2]).toMatchObject({ collection: 'brief-items', op: 'create', data: { topic: 'T' } })
    expect(result.version).toBe(2)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test src/lib/briefs/versioning.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement `createNextBriefVersion`**

Create `src/lib/briefs/versioning.ts`:

```ts
import type { Payload } from 'payload'
import type { EditorialBrief, User } from '@/payload-types'
import type { ExtractedBriefItem } from '@/lib/brief-extraction'
import { createBriefItems } from './create-items'

export interface NewVersionInput {
  payload: Payload
  user: User
  previous: EditorialBrief
  items: ExtractedBriefItem[]
  rawParseSnapshot: unknown
  sourceType: 'paste' | 'docx' | 'pdf'
  sourceFile?: string
  rawText: string
  title: string
}

/** Supersedes `previous` and creates the next version as a fresh 'parsed' draft - shared by
 *  both the duplicate-upload "replace" choice (Task 11) and re-editing an already-confirmed
 *  brief (Task 12), since both need the exact same version-chain mechanics. */
export async function createNextBriefVersion(input: NewVersionInput): Promise<EditorialBrief> {
  const { payload, user, previous, items, rawParseSnapshot, sourceType, sourceFile, rawText, title } = input

  await payload.update({
    collection: 'editorial-briefs',
    id: previous.id,
    data: { status: 'superseded' },
    overrideAccess: false,
    user,
  })

  const brief = await payload.create({
    collection: 'editorial-briefs',
    data: {
      title,
      channel: previous.channel,
      uploadedBy: user.id,
      status: 'parsed',
      rawParseSnapshot,
      sourceType,
      sourceFile,
      rawText,
      version: previous.version + 1,
      previousVersion: previous.id,
    },
    overrideAccess: false,
    user,
  })

  await createBriefItems(payload, user, brief.id, items)

  return brief
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test src/lib/briefs/versioning.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/briefs
git commit -m "feat: add shared brief creation and versioning helpers"
```

---

### Task 10: Auth routing restructure + dashboard shell (Sidebar, Header, channel switcher, logout)

**Files:**
- Modify: `src/payload/auth/session.ts`
- Create: `src/app/globals.css` (moved from `src/app/(dashboard)/globals.css`)
- Delete: `src/app/(dashboard)/globals.css`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx` (moved from `src/app/(dashboard)/login/page.tsx`)
- Create: `src/app/(auth)/login/actions.ts` (moved from `src/app/(dashboard)/login/actions.ts`)
- Delete: `src/app/(dashboard)/login/` (whole directory)
- Modify: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/Sidebar.tsx`
- Create: `src/app/(dashboard)/Header.tsx`
- Create: `src/app/(dashboard)/ChannelSwitcher.tsx`
- Create: `src/app/(dashboard)/LogoutButton.tsx`
- Create: `src/app/(dashboard)/shell-actions.ts`

**Why this is needed now:** `(dashboard)/layout.tsx` is about to render `Sidebar`/`Header`, both of
which call `requireUser()` — if `/login` stayed inside `(dashboard)`, visiting it while logged out
would make the layout itself redirect to `/login`, which re-renders the same layout, which
redirects again: an infinite loop. Moving `/login` into its own route group (mirroring how
`trt-global-cms-prod` keeps its own `(app)` and `(payload)` groups separate) fixes this
structurally, not with a special-case flag.

**Interfaces:**
- Consumes: `getSwitcherDesks` from `@/lib/desks` (Task 5).
- Produces (used by Tasks 11, 12, 13): the `selected-channel` cookie (read via `cookies()`), and
  a `getCurrentUser`/`requireUser` that are now request-deduped via React's `cache()`.

- [ ] **Step 1: Dedupe `getCurrentUser` per request**

In `src/payload/auth/session.ts`, wrap the export:

```ts
import { cache } from 'react'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { User } from '@/payload-types'

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })
  return user as User | null
})

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
```

(Sidebar, Header, and the page itself will each call `requireUser()` in the same request; React's
`cache()` means only one actual `payload.auth()` lookup happens per request instead of three.)

- [ ] **Step 2: Move globals.css to the app root**

```bash
git mv "src/app/(dashboard)/globals.css" src/app/globals.css
```

Append the shell styles to `src/app/globals.css`:

```css
.shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 200px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sidebar a {
  color: #111827;
  text-decoration: none;
  font-size: 0.9375rem;
}

.sidebar a:hover {
  color: #4c89d0;
}

.shell-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.shell-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.shell-header .email {
  color: #6b7280;
  font-size: 0.875rem;
  margin-right: auto;
}

.shell-header select,
.shell-header button {
  width: auto;
  margin-bottom: 0;
}
```

- [ ] **Step 3: Move `/login` into its own route group**

```bash
mkdir -p "src/app/(auth)/login"
git mv "src/app/(dashboard)/login/page.tsx" "src/app/(auth)/login/page.tsx"
git mv "src/app/(dashboard)/login/actions.ts" "src/app/(auth)/login/actions.ts"
rmdir "src/app/(dashboard)/login"
```

Create `src/app/(auth)/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import '../globals.css'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Fix the dashboard layout's globals.css import**

In `src/app/(dashboard)/layout.tsx`, change:

```tsx
import './globals.css'
```

to:

```tsx
import '../globals.css'
```

- [ ] **Step 5: Write the shell server actions**

Create `src/app/(dashboard)/shell-actions.ts`:

```ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function setSelectedChannel(channelId: string): Promise<void> {
  ;(await cookies()).set('selected-channel', channelId, { path: '/', sameSite: 'lax' })
}

export async function logout(): Promise<void> {
  ;(await cookies()).delete('payload-token')
  redirect('/login')
}
```

- [ ] **Step 6: Write the ChannelSwitcher client component**

Create `src/app/(dashboard)/ChannelSwitcher.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setSelectedChannel } from './shell-actions'
import type { Desk } from '@/lib/desks'

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

  return (
    <select
      value={selected}
      disabled={isPending}
      onChange={(event) => {
        const value = event.target.value
        startTransition(async () => {
          await setSelectedChannel(value)
          router.refresh()
        })
      }}
    >
      {showAllOption && <option value="all">All channels</option>}
      {desks.map((desk) => (
        <option key={desk.id} value={desk.id}>
          {desk.name}
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 7: Write the LogoutButton client component**

Create `src/app/(dashboard)/LogoutButton.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { logout } from './shell-actions'

export function LogoutButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button type="button" disabled={isPending} onClick={() => startTransition(() => logout())}>
      {isPending ? 'Signing out…' : 'Log out'}
    </button>
  )
}
```

- [ ] **Step 8: Write the Header server component**

Create `src/app/(dashboard)/Header.tsx`:

```tsx
import { cookies } from 'next/headers'
import { requireUser } from '@/payload/auth/session'
import { getSwitcherDesks } from '@/lib/desks'
import { ChannelSwitcher } from './ChannelSwitcher'
import { LogoutButton } from './LogoutButton'

export async function Header() {
  const user = await requireUser()
  const desks = await getSwitcherDesks(user)
  const hasAnyLead = (user.leadOfDesks?.length ?? 0) > 0
  const showAllOption = user.role === 'admin' || !hasAnyLead
  const cookieStore = await cookies()
  const selected = cookieStore.get('selected-channel')?.value ?? (showAllOption ? 'all' : (desks[0]?.id ?? 'all'))

  return (
    <header className="shell-header">
      <span className="email">{user.email}</span>
      <ChannelSwitcher desks={desks} selected={selected} showAllOption={showAllOption} />
      <LogoutButton />
    </header>
  )
}
```

- [ ] **Step 9: Write the Sidebar server component**

Create `src/app/(dashboard)/Sidebar.tsx`:

```tsx
import Link from 'next/link'
import { requireUser } from '@/payload/auth/session'

export async function Sidebar() {
  const user = await requireUser()

  return (
    <nav className="sidebar">
      <Link href="/">Dashboard</Link>
      <Link href="/briefs">Briefs</Link>
      {user.role === 'admin' && <a href="/admin">Open admin panel</a>}
    </nav>
  )
}
```

- [ ] **Step 10: Wire Sidebar and Header into the dashboard layout**

Replace the contents of `src/app/(dashboard)/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import '../globals.css'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidebar />
          <div className="shell-main">
            <Header />
            <main>{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 11: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 12: Manual verification**

1. `bun run dev` (or confirm the already-running dev server picked up the changes).
2. Visit `/login` directly while logged out — confirm it renders the bare login card with no
   sidebar/header and does **not** loop or redirect.
3. Log in as `editor-a@newsroom.local` (or whichever test user exists from the previous
   feature) — land on `/`, now with a sidebar (Dashboard/Briefs links) and a header showing the
   email, a channel dropdown, and a Log out button. Since `CMS_BASE_URL` is still a placeholder,
   the channel dropdown will be empty except for "All channels" — confirm the page still renders
   without crashing (this is the resilience behavior from Task 5's `fetchChannelsSafely`).
4. Click Log out — confirm it redirects to `/login` and a subsequent visit to `/` bounces back to
   `/login` (session actually cleared).

- [ ] **Step 13: Commit**

```bash
git add src/payload/auth/session.ts src/app/globals.css "src/app/(auth)" "src/app/(dashboard)"
git commit -m "feat: add dashboard shell (sidebar, header, channel switcher, logout)"
```

---

### Task 11: Upload flow (`uploadBrief` action + `/briefs/new` page)

**Files:**
- Create: `src/app/(dashboard)/briefs/new/actions.ts`
- Create: `src/app/(dashboard)/briefs/new/UploadForm.tsx`
- Create: `src/app/(dashboard)/briefs/new/page.tsx`

**Interfaces:**
- Consumes: `getLeadDesks` (Task 5), `extractTextFromDocx`/`extractTextFromPdf` (Task 6),
  `extractBrief`/`EmptyBriefError` (Task 7), `createBriefItems` (Task 9),
  `createNextBriefVersion` (Task 9), `isLeadOfDesk` (Task 1).
- Produces (used by Task 13's dashboard link, and by manual navigation): the `/briefs/new` route.

- [ ] **Step 1: Write the uploadBrief server action**

Create `src/app/(dashboard)/briefs/new/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { isLeadOfDesk } from '@/payload/access/admin'
import { extractTextFromDocx, extractTextFromPdf } from '@/lib/brief-extraction/text-extraction'
import { extractBrief, EmptyBriefError } from '@/lib/brief-extraction'
import { createBriefItems } from '@/lib/briefs/create-items'
import { createNextBriefVersion } from '@/lib/briefs/versioning'

export type UploadBriefState = { error: string | null; duplicateOf: string | null }

export async function uploadBrief(_prev: UploadBriefState, formData: FormData): Promise<UploadBriefState> {
  const user = await requireUser()
  const channel = formData.get('channel') as string
  const title = formData.get('title') as string
  const pasteText = formData.get('pasteText') as string
  const file = formData.get('file') as File | null
  const duplicateChoice = formData.get('duplicateChoice') as 'replace' | 'parallel' | ''

  if (!channel) return { error: 'Choose a desk.', duplicateOf: null }
  if (!isLeadOfDesk(user, channel)) return { error: 'You are not a lead of this desk.', duplicateOf: null }

  let rawText: string
  let sourceType: 'paste' | 'docx' | 'pdf'
  let fileBuffer: Buffer | null = null
  let fileName = ''
  let fileMimeType = ''

  if (file && file.size > 0) {
    fileBuffer = Buffer.from(await file.arrayBuffer())
    fileName = file.name
    fileMimeType = file.type
    if (file.type === 'application/pdf') {
      sourceType = 'pdf'
      rawText = await extractTextFromPdf(fileBuffer)
    } else {
      sourceType = 'docx'
      rawText = await extractTextFromDocx(fileBuffer)
    }
  } else if (pasteText && pasteText.trim()) {
    sourceType = 'paste'
    rawText = pasteText.trim()
  } else {
    return { error: 'Paste the brief text or upload a file.', duplicateOf: null }
  }

  const payload = await getPayload({ config: configPromise })

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const existing = await payload.find({
    collection: 'editorial-briefs',
    where: {
      and: [
        { channel: { equals: channel } },
        { status: { not_equals: 'superseded' } },
        { createdAt: { greater_than_equal: startOfDay.toISOString() } },
      ],
    },
    limit: 1,
    overrideAccess: false,
    user,
  })

  if (existing.docs.length > 0 && !duplicateChoice) {
    return { error: null, duplicateOf: existing.docs[0].id }
  }

  let items
  try {
    items = await extractBrief(rawText)
  } catch (err) {
    if (err instanceof EmptyBriefError) return { error: err.message, duplicateOf: null }
    return { error: 'Could not parse this brief. Try again.', duplicateOf: null }
  }

  let sourceFileId: string | undefined
  if (fileBuffer) {
    const fileDoc = await payload.create({
      collection: 'brief-files',
      data: { channel },
      file: { data: fileBuffer, mimetype: fileMimeType, name: fileName, size: fileBuffer.length },
      overrideAccess: false,
      user,
    })
    sourceFileId = fileDoc.id
  }

  const briefTitle = title || `Brief ${new Date().toISOString().slice(0, 10)}`
  let briefId: string

  if (duplicateChoice === 'replace' && existing.docs.length > 0) {
    const nextVersion = await createNextBriefVersion({
      payload,
      user,
      previous: existing.docs[0],
      items,
      rawParseSnapshot: items,
      sourceType,
      sourceFile: sourceFileId,
      rawText,
      title: briefTitle,
    })
    briefId = nextVersion.id
  } else {
    const brief = await payload.create({
      collection: 'editorial-briefs',
      data: {
        title: briefTitle,
        channel,
        uploadedBy: user.id,
        status: 'parsed',
        rawParseSnapshot: items,
        sourceType,
        sourceFile: sourceFileId,
        rawText,
        version: 1,
      },
      overrideAccess: false,
      user,
    })
    await createBriefItems(payload, user, brief.id, items)
    briefId = brief.id
  }

  revalidatePath('/briefs')
  redirect(`/briefs/${briefId}`)
}
```

- [ ] **Step 2: Write the upload form client component**

Create `src/app/(dashboard)/briefs/new/UploadForm.tsx`:

```tsx
'use client'

import { useActionState, useState } from 'react'
import { uploadBrief, type UploadBriefState } from './actions'
import type { Desk } from '@/lib/desks'

const initialState: UploadBriefState = { error: null, duplicateOf: null }

export function UploadForm({ desks }: { desks: Desk[] }) {
  const [mode, setMode] = useState<'paste' | 'file'>('paste')
  const [duplicateChoice, setDuplicateChoice] = useState<'replace' | 'parallel' | ''>('')
  const [state, formAction, isPending] = useActionState(uploadBrief, initialState)

  if (desks.length === 0) {
    return <p>You are not a lead on any desk, so you cannot upload a brief.</p>
  }

  if (state.duplicateOf && !duplicateChoice) {
    return (
      <div className="card">
        <p>A brief was already uploaded for this desk today.</p>
        <button type="button" onClick={() => setDuplicateChoice('replace')}>
          Replace it
        </button>
        <button type="button" onClick={() => setDuplicateChoice('parallel')}>
          Create a parallel brief
        </button>
      </div>
    )
  }

  return (
    <form action={formAction}>
      <label htmlFor="channel">Desk</label>
      <select id="channel" name="channel" required defaultValue={desks[0]?.id}>
        {desks.map((desk) => (
          <option key={desk.id} value={desk.id}>
            {desk.name}
          </option>
        ))}
      </select>

      <label htmlFor="title">Title (optional)</label>
      <input id="title" name="title" type="text" />

      <div>
        <button type="button" onClick={() => setMode('paste')} disabled={mode === 'paste'}>
          Paste text
        </button>
        <button type="button" onClick={() => setMode('file')} disabled={mode === 'file'}>
          Upload file
        </button>
      </div>

      {mode === 'paste' ? (
        <>
          <label htmlFor="pasteText">Brief text</label>
          <textarea id="pasteText" name="pasteText" rows={12} />
        </>
      ) : (
        <>
          <label htmlFor="file">Brief file (.docx or .pdf)</label>
          <input id="file" name="file" type="file" accept=".docx,.pdf" />
        </>
      )}

      {duplicateChoice && <input type="hidden" name="duplicateChoice" value={duplicateChoice} />}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Parsing…' : 'Upload and parse'}
      </button>
      {state.error && <p className="error">{state.error}</p>}
    </form>
  )
}
```

- [ ] **Step 3: Write the upload page**

Create `src/app/(dashboard)/briefs/new/page.tsx`:

```tsx
import { requireUser } from '@/payload/auth/session'
import { getLeadDesks } from '@/lib/desks'
import { UploadForm } from './UploadForm'

export default async function NewBriefPage() {
  const user = await requireUser()
  const desks = await getLeadDesks(user)

  return (
    <div className="page">
      <h1>Upload daily brief</h1>
      <div className="card">
        <UploadForm desks={desks} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

1. As an admin (`admin@newsroom.local`), give yourself `leadOfDesks` via `/admin` →
   `Users` → your user → set `leadOfDesks` to `['test-channel']` (the same fake channel id used
   by the previous feature's seed data — `CMS_BASE_URL` being a placeholder means
   `getLeadDesks` will return `[]` from the live channel list regardless of `leadOfDesks`, since
   the desk name has to come from `listChannels()`. **This means `/briefs/new` will show "You are
   not a lead on any desk" for everyone until `CMS_BASE_URL`/`CMS_API_KEY` point at a reachable
   cms-prod** — note this limitation to the user rather than silently working around it; it's a
   pre-existing environment gap, not a bug in this task.)
2. If a reachable cms-prod becomes available before this task is verified, upload a pasted brief
   (e.g. the `trt-editorial-n8n/sample-brief.txt` content) for a desk you lead — confirm it
   redirects to `/briefs/[id]` and the parsed topics look reasonable (Gaza ceasefire, central
   bank, EU migration, wildfires — matching the sample's four stories).
3. Upload a second brief for the same desk same day — confirm the replace/parallel prompt
   appears instead of silently creating or erroring.
4. Paste something with no discernible news topics (e.g. `"hello"`) — confirm you get "No topics
   found in this brief." and no `editorial-briefs` doc was created (`db["editorial-briefs"].find()`
   in `mongosh` should show no new doc for that attempt).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/briefs/new"
git commit -m "feat: add brief upload flow with parse and duplicate handling"
```

---

### Task 12: Briefs list + review/confirm page

**Files:**
- Create: `src/app/(dashboard)/briefs/page.tsx`
- Create: `src/app/(dashboard)/briefs/[id]/actions.ts`
- Create: `src/app/(dashboard)/briefs/[id]/BriefItemsForm.tsx`
- Create: `src/app/(dashboard)/briefs/[id]/page.tsx`

**Interfaces:**
- Consumes: `diffBriefItems` (Task 8), `createNextBriefVersion` (Task 9), `leadOfDeskBriefUpdate`
  access (enforced by Payload itself, not called directly here).
- Produces: `/briefs` and `/briefs/[id]` routes.

- [ ] **Step 1: Write the briefs list page**

Create `src/app/(dashboard)/briefs/page.tsx`:

```tsx
import Link from 'next/link'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'

export default async function BriefsPage() {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  const briefs = await payload.find({
    collection: 'editorial-briefs',
    where: { status: { not_equals: 'superseded' } },
    sort: '-createdAt',
    limit: 50,
    overrideAccess: false,
    user,
  })

  return (
    <div className="page">
      <h1>Briefs</h1>
      <p className="subtitle">
        <Link href="/briefs/new">Upload a new brief</Link>
      </p>
      <div className="card">
        {briefs.docs.length === 0 ? (
          <p>No briefs yet.</p>
        ) : (
          <ul className="list">
            {briefs.docs.map((brief) => (
              <li key={brief.id} className="list-item">
                <span>
                  {brief.title} — {brief.channelName ?? brief.channel}
                </span>
                <span>
                  <span className="badge">{brief.status}</span> <Link href={`/briefs/${brief.id}`}>Open</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the save/confirm server actions**

Create `src/app/(dashboard)/briefs/[id]/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { createNextBriefVersion } from '@/lib/briefs/versioning'
import type { ExtractedBriefItem } from '@/lib/brief-extraction'

export type SaveBriefState = { error: string | null }

/** A confirmed brief's items are never edited in place - editing runs the same supersede/
 *  new-version mechanics as the duplicate-upload "replace" choice, and redirects to the new
 *  version so the lead re-confirms it (spec: "Re-edit after confirm"). An unconfirmed ('parsed')
 *  brief's items are just updated directly. */
export async function saveBriefItems(briefId: string, items: (ExtractedBriefItem & { id?: string })[]) {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  const brief = await payload.findByID({ collection: 'editorial-briefs', id: briefId, overrideAccess: false, user })

  if (brief.status === 'confirmed') {
    const nextVersion = await createNextBriefVersion({
      payload,
      user,
      previous: brief,
      items,
      rawParseSnapshot: (await payload.find({
        collection: 'brief-items',
        where: { brief: { equals: briefId } },
        limit: 100,
        overrideAccess: false,
        user,
      })).docs,
      sourceType: brief.sourceType,
      sourceFile: typeof brief.sourceFile === 'string' ? brief.sourceFile : brief.sourceFile?.id,
      rawText: brief.rawText,
      title: brief.title,
    })
    redirect(`/briefs/${nextVersion.id}`)
  }

  const existingItems = await payload.find({
    collection: 'brief-items',
    where: { brief: { equals: briefId } },
    limit: 100,
    overrideAccess: false,
    user,
  })
  const existingIds = new Set(existingItems.docs.map((doc) => doc.id))
  const incomingIds = new Set(items.map((item) => item.id).filter(Boolean))

  for (const item of items) {
    const { id, ...data } = item
    if (id && existingIds.has(id)) {
      await payload.update({ collection: 'brief-items', id, data, overrideAccess: false, user })
    } else {
      await payload.create({
        collection: 'brief-items',
        data: { brief: briefId, status: 'pending', ...data },
        overrideAccess: false,
        user,
      })
    }
  }

  for (const existingId of existingIds) {
    if (!incomingIds.has(existingId)) {
      await payload.delete({ collection: 'brief-items', id: existingId, overrideAccess: false, user })
    }
  }

  revalidatePath(`/briefs/${briefId}`)
}

export async function confirmBrief(briefId: string): Promise<{ error: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    await payload.update({
      collection: 'editorial-briefs',
      id: briefId,
      data: { status: 'confirmed', confirmedBy: user.id, confirmedAt: new Date().toISOString() },
      overrideAccess: false,
      user,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not confirm this brief.' }
  }

  revalidatePath(`/briefs/${briefId}`)
  revalidatePath('/briefs')
  return { error: null }
}
```

- [ ] **Step 3: Write the editable items form**

Create `src/app/(dashboard)/briefs/[id]/BriefItemsForm.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { BriefItemDiffEntry } from '@/lib/brief-diff'
import { saveBriefItems, confirmBrief } from './actions'

type EditableItem = {
  id?: string
  topic: string
  angle: string
  priorityOrder: number
  region: string
  keywords: string[]
  exclusions: string[]
  sentiment: string
  portrayalNotes: string
  bannedTerms: string[]
  requiredContext: string
}

function ArrayField({
  values,
  onChange,
}: {
  values: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div>
      {values.map((value, index) => (
        <div key={index} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={value}
            onChange={(event) => {
              const next = [...values]
              next[index] = event.target.value
              onChange(next)
            }}
          />
          <button type="button" onClick={() => onChange(values.filter((_, i) => i !== index))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...values, ''])}>
        Add
      </button>
    </div>
  )
}

export function BriefItemsForm({
  briefId,
  briefStatus,
  initialItems,
  diffEntries,
}: {
  briefId: string
  briefStatus: string
  initialItems: EditableItem[]
  diffEntries: BriefItemDiffEntry[]
}) {
  const [items, setItems] = useState(initialItems)
  const [showDiff, setShowDiff] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()
  const [isConfirming, startConfirm] = useTransition()

  function updateItem(index: number, patch: Partial<EditableItem>) {
    const next = [...items]
    next[index] = { ...next[index], ...patch }
    setItems(next)
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    next.forEach((item, i) => {
      item.priorityOrder = i + 1
    })
    setItems(next)
  }

  function addTopic() {
    setItems([
      ...items,
      {
        topic: '',
        angle: '',
        priorityOrder: items.length + 1,
        region: '',
        keywords: [],
        exclusions: [],
        sentiment: '',
        portrayalNotes: '',
        bannedTerms: [],
        requiredContext: '',
      },
    ])
  }

  function removeTopic(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  return (
    <div className="card">
      <button type="button" onClick={() => setShowDiff((value) => !value)}>
        {showDiff ? 'Hide original parse' : 'View original parse'}
      </button>

      {showDiff ? (
        <ul className="list" style={{ marginTop: '1rem' }}>
          {diffEntries.map((entry) => (
            <li key={entry.topic} className={`list-item diff-${entry.status}`}>
              <strong>{entry.topic}</strong> — {entry.status}
              {Object.entries(entry.fieldChanges).map(([field, change]) => (
                <div key={field}>
                  {field}: {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
                </div>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <>
          {items.map((item, index) => (
            <div key={item.id ?? `new-${index}`} className="card" style={{ marginTop: '1rem' }}>
              <label>Topic</label>
              <input type="text" value={item.topic} onChange={(e) => updateItem(index, { topic: e.target.value })} />

              <label>Angle</label>
              <input type="text" value={item.angle} onChange={(e) => updateItem(index, { angle: e.target.value })} />

              <label>Priority order</label>
              <input
                type="number"
                value={item.priorityOrder}
                onChange={(e) => updateItem(index, { priorityOrder: Number(e.target.value) })}
              />
              <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0}>
                Move up
              </button>
              <button type="button" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}>
                Move down
              </button>

              <label>Region</label>
              <input type="text" value={item.region} onChange={(e) => updateItem(index, { region: e.target.value })} />

              <label>Exclusions</label>
              <ArrayField values={item.exclusions} onChange={(exclusions) => updateItem(index, { exclusions })} />

              <label>Keywords</label>
              <ArrayField values={item.keywords} onChange={(keywords) => updateItem(index, { keywords })} />

              <label>Banned terms</label>
              <ArrayField values={item.bannedTerms} onChange={(bannedTerms) => updateItem(index, { bannedTerms })} />

              <button type="button" onClick={() => removeTopic(index)}>
                Remove topic
              </button>
            </div>
          ))}

          <button type="button" onClick={addTopic} style={{ marginTop: '1rem' }}>
            Add topic
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() =>
              startSave(async () => {
                setSaveError(null)
                try {
                  await saveBriefItems(briefId, items)
                } catch (err) {
                  setSaveError(err instanceof Error ? err.message : 'Could not save.')
                }
              })
            }
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          {saveError && <p className="error">{saveError}</p>}

          {briefStatus !== 'confirmed' && (
            <button
              type="button"
              disabled={isConfirming}
              onClick={() =>
                startConfirm(async () => {
                  const result = await confirmBrief(briefId)
                  setConfirmError(result.error)
                })
              }
            >
              {isConfirming ? 'Confirming…' : 'Confirm brief'}
            </button>
          )}
          {confirmError && <p className="error">{confirmError}</p>}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write the review page**

Create `src/app/(dashboard)/briefs/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { diffBriefItems, type DiffableBriefItem } from '@/lib/brief-diff'
import { BriefItemsForm } from './BriefItemsForm'

export default async function BriefReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  let brief
  try {
    brief = await payload.findByID({ collection: 'editorial-briefs', id, overrideAccess: false, user })
  } catch {
    notFound()
  }
  if (!brief) notFound()

  const items = await payload.find({
    collection: 'brief-items',
    where: { brief: { equals: id } },
    sort: 'priorityOrder',
    limit: 100,
    overrideAccess: false,
    user,
  })

  const currentItems = items.docs.map((item) => ({
    id: item.id,
    topic: item.topic,
    angle: item.angle ?? '',
    priorityOrder: item.priorityOrder ?? 0,
    region: item.region ?? '',
    keywords: item.keywords ?? [],
    exclusions: item.exclusions ?? [],
    sentiment: item.sentiment ?? '',
    portrayalNotes: item.portrayalNotes ?? '',
    bannedTerms: item.bannedTerms ?? [],
    requiredContext: item.requiredContext ?? '',
  }))

  const originalItems = (brief.rawParseSnapshot ?? []) as DiffableBriefItem[]
  const diffEntries = diffBriefItems(originalItems, currentItems)

  return (
    <div className="page">
      <h1>{brief.title}</h1>
      <p className="subtitle">
        {brief.channelName ?? brief.channel} — <span className="badge">{brief.status}</span> — version {brief.version}
      </p>

      <BriefItemsForm briefId={brief.id} briefStatus={brief.status} initialItems={currentItems} diffEntries={diffEntries} />
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

(Requires Task 11's blocker — a reachable `CMS_BASE_URL` — to actually get a brief onto this
page via the upload flow. If cms-prod access still isn't sorted, seed an `editorial-briefs` +
`brief-items` doc directly via the Payload local API or `/admin`, matching the shape Task 11
produces, to unblock this verification independently.)

1. Open `/briefs/[id]` for a `parsed` brief — confirm all fields render editable, add/remove/
   move-up/move-down work on topics, array fields (exclusions/keywords/bannedTerms) can add/
   remove rows.
2. Click "View original parse" — confirm the diff view renders and reflects any edits made.
3. Save — confirm the page reloads with the edits persisted (`brief-items` docs updated/created/
   deleted correctly — verify a topic removal actually deletes its row via `mongosh`).
4. Confirm the brief — confirm `status` becomes `confirmed`, `confirmedBy`/`confirmedAt` are set,
   and the "Confirm brief" button disappears.
5. Edit a field on the now-confirmed brief and Save — confirm you're redirected to a **new**
   `/briefs/[newId]` with `version: 2`, `status: 'parsed'`, and the old brief now `superseded`.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/briefs"
git commit -m "feat: add briefs list and review/confirm page"
```

---

### Task 13: Dashboard channel scoping

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: the `selected-channel` cookie (set by Task 10's `ChannelSwitcher`).

- [ ] **Step 1: Read the cookie and scope the queries**

In `src/app/(dashboard)/page.tsx`, add the import and read the cookie, then scope both queries:

```tsx
import { cookies } from 'next/headers'
```

Replace the body of `DashboardPage` with:

```tsx
export default async function DashboardPage() {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })
  const cookieStore = await cookies()
  const selectedChannel = cookieStore.get('selected-channel')?.value ?? 'all'

  const [allPieces, allAssignments, myAssignments] = await Promise.all([
    payload.find({
      collection: 'generated-pieces',
      where: selectedChannel === 'all' ? undefined : { channel: { equals: selectedChannel } },
      limit: 100,
      depth: 1,
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'piece-assignments',
      limit: 100,
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'piece-assignments',
      where: { assignedTo: { equals: user.id } },
      limit: 100,
      depth: 2,
      overrideAccess: false,
      user,
    }),
  ])

  const claimedPieceIds = new Set(
    allAssignments.docs.map((assignment) => (typeof assignment.piece === 'string' ? assignment.piece : assignment.piece.id)),
  )
  const unclaimedPieces = allPieces.docs.filter((piece) => !claimedPieceIds.has(piece.id))

  const myFilteredAssignments =
    selectedChannel === 'all'
      ? myAssignments.docs
      : myAssignments.docs.filter((assignment) => {
          const piece = assignment.piece
          return typeof piece === 'object' && piece.channel === selectedChannel
        })

  // ... rest of the JSX below is unchanged except `myAssignments.docs.map(...)` becomes
  // `myFilteredAssignments.map(...)`
```

Leave the rest of the file (the JSX returning the two `<div className="card">` sections) exactly
as it is, except change `myAssignments.docs.map((assignment: PieceAssignment) => {` to
`myFilteredAssignments.map((assignment: PieceAssignment) => {`.

- [ ] **Step 2: Type-check**

Run: `bun run check-types`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

1. On `/`, switch the header's channel dropdown away from "All channels" to a specific channel
   (if the dropdown has any options — otherwise this step is blocked by the same `CMS_BASE_URL`
   limitation as Task 11/12, and should be re-verified once that's sorted).
2. Confirm the unclaimed-pieces list only shows pieces with a matching `channel`, and "My
   pieces" only shows assignments whose piece matches that channel.
3. Switch back to "All channels" — confirm both lists return to showing everything.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/page.tsx"
git commit -m "feat: scope dashboard queues by the selected channel"
```
