# Piece Approve → Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After QA `goodToGo`, desk leads/admins Approve or Send back on `/pieces/[id]`, then Publish to CMS — driven only by extended `piece-assignments.status`.

**Architecture:** Extend assignment status options; fix `submitVerdict` transitions; add lead-gated `approvePiece` / `sendBackPiece` / `publishPiece` actions (lead check in action + `overrideAccess: true` after authz); piece-page stepper UI for Edit → QA → Approve → Publish.

**Tech Stack:** Next.js 15 App Router, Payload 3, Bun, existing `getCmsClient().createArticle()`.

## Global Constraints

- Approve / Send back / Publish: admin or `isLeadOfDesk(user, piece.channel)` only.
- Publish only from status `approved` (not merely `goodToGo`).
- No new collections; no send-back note field in v1.
- Prefer stub-safe CMS publish via existing `getCmsClient()` (stub when env unset).

---

## File map

| File | Role |
| --- | --- |
| `src/lib/pieces/assignment-status.ts` | Pure helpers: next status after verdict; step derivation; lead gate predicate |
| `src/lib/pieces/assignment-status.test.ts` | Unit tests for those helpers |
| `src/payload/collections/piece-assignments/index.ts` | Add status options |
| `src/payload-types.ts` | Regenerate or hand-update status union |
| `src/app/(dashboard)/pieces/[id]/actions.ts` | Verdict transitions + approve/sendBack/publish |
| `src/app/(dashboard)/pieces/[id]/PieceStepper.tsx` | Stepper chrome |
| `src/app/(dashboard)/pieces/[id]/LeadActions.tsx` | Approve / Send back / Publish buttons |
| `src/app/(dashboard)/pieces/[id]/page.tsx` | Wire stepper + lead actions |
| `src/app/globals.css` | Minimal stepper styles (reuse `.brief-stepper` patterns if present) |
| `src/app/(dashboard)/page.tsx` | Show new status badges (already displays `assignment.status`) |

---

### Task 1: Status helpers + schema options

**Files:**
- Create: `src/lib/pieces/assignment-status.ts`
- Create: `src/lib/pieces/assignment-status.test.ts`
- Modify: `src/payload/collections/piece-assignments/index.ts`
- Modify: `src/payload-types.ts` (status union on `PieceAssignment`)

**Interfaces:**
- Produces:
  - `export type AssignmentStatus = 'claimed' | 'inProgress' | 'inQA' | 'verdictReached' | 'awaitingApproval' | 'approved' | 'published'`
  - `export type PieceStepperStep = 'edit' | 'qa' | 'approve' | 'publish'`
  - `statusAfterVerdict(verdict: 'goodToGo' | 'needsAttention' | 'rejected'): AssignmentStatus`
  - `stepFromStatus(status: AssignmentStatus): PieceStepperStep`
  - `canLeadActOnPiece(user: { role?: string | null; leadOfDesks?: string[] | null } | null, channel: string): boolean`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, test } from 'bun:test'
import {
  canLeadActOnPiece,
  statusAfterVerdict,
  stepFromStatus,
} from './assignment-status'

describe('statusAfterVerdict', () => {
  test('goodToGo → awaitingApproval', () => {
    expect(statusAfterVerdict('goodToGo')).toBe('awaitingApproval')
  })
  test('needsAttention / rejected → inProgress', () => {
    expect(statusAfterVerdict('needsAttention')).toBe('inProgress')
    expect(statusAfterVerdict('rejected')).toBe('inProgress')
  })
})

describe('stepFromStatus', () => {
  test('maps statuses to stepper steps', () => {
    expect(stepFromStatus('claimed')).toBe('edit')
    expect(stepFromStatus('inProgress')).toBe('edit')
    expect(stepFromStatus('inQA')).toBe('qa')
    expect(stepFromStatus('verdictReached')).toBe('qa')
    expect(stepFromStatus('awaitingApproval')).toBe('approve')
    expect(stepFromStatus('approved')).toBe('publish')
    expect(stepFromStatus('published')).toBe('publish')
  })
})

describe('canLeadActOnPiece', () => {
  test('admin always', () => {
    expect(canLeadActOnPiece({ role: 'admin', leadOfDesks: [] }, 'ch-1')).toBe(true)
  })
  test('lead of channel', () => {
    expect(canLeadActOnPiece({ role: 'editor', leadOfDesks: ['ch-1'] }, 'ch-1')).toBe(true)
  })
  test('non-lead editor denied', () => {
    expect(canLeadActOnPiece({ role: 'editor', leadOfDesks: ['ch-2'] }, 'ch-1')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bun test src/lib/pieces/assignment-status.test.ts`

- [ ] **Step 3: Implement helpers + schema**

`src/lib/pieces/assignment-status.ts`:

```ts
import { checkIsAdmin, isLeadOfDesk } from '@/payload/access/admin'
import type { User } from '@/payload-types'

export type AssignmentStatus =
  | 'claimed'
  | 'inProgress'
  | 'inQA'
  | 'verdictReached'
  | 'awaitingApproval'
  | 'approved'
  | 'published'

export type PieceStepperStep = 'edit' | 'qa' | 'approve' | 'publish'

export function statusAfterVerdict(
  verdict: 'goodToGo' | 'needsAttention' | 'rejected',
): AssignmentStatus {
  return verdict === 'goodToGo' ? 'awaitingApproval' : 'inProgress'
}

export function stepFromStatus(status: AssignmentStatus): PieceStepperStep {
  switch (status) {
    case 'inQA':
    case 'verdictReached':
      return 'qa'
    case 'awaitingApproval':
      return 'approve'
    case 'approved':
    case 'published':
      return 'publish'
    default:
      return 'edit'
  }
}

export function canLeadActOnPiece(
  user: Pick<User, 'role' | 'leadOfDesks'> | null,
  channel: string,
): boolean {
  if (!user) return false
  if (checkIsAdmin(user as User)) return true
  return isLeadOfDesk(user as User, channel)
}
```

Update `piece-assignments` status options to the full `AssignmentStatus` list.

Update `PieceAssignment['status']` union in `payload-types.ts` to match.

- [ ] **Step 4: Run tests — expect PASS**

Run: `bun test src/lib/pieces/assignment-status.test.ts`

- [ ] **Step 5: Commit** (only if user asked for commits; otherwise skip)

---

### Task 2: Server actions — verdict transitions + lead gates + publish

**Files:**
- Modify: `src/app/(dashboard)/pieces/[id]/actions.ts`
- Test: extend `src/lib/pieces/assignment-status.test.ts` is enough for pure logic; action authz is covered by manual + helper tests. Optional: thin pure `assertLeadTransition` if extracted — keep logic inline in actions using helpers.

**Interfaces:**
- Consumes: `statusAfterVerdict`, `canLeadActOnPiece`, `getCmsClient`
- Produces:
  - `approvePiece(pieceId: string): Promise<{ error: string | null }>`
  - `sendBackPiece(pieceId: string): Promise<{ error: string | null }>`
  - `publishPiece(pieceId: string): Promise<{ error: string | null }>`
  - `submitVerdict` sets assignment status via `statusAfterVerdict`

- [ ] **Step 1: Update `submitVerdict` status write**

Replace the hard-coded `status: 'inQA'` update with:

```ts
data: { status: statusAfterVerdict(verdict) },
```

- [ ] **Step 2: Add shared lead lookup helper inside actions file**

```ts
async function loadPieceAssignmentForLead(pieceId: string, user: User) {
  const payload = await getPayload({ config: configPromise })
  const piece = await payload.findByID({
    collection: 'generated-pieces',
    id: pieceId,
    overrideAccess: true,
  })
  if (!canLeadActOnPiece(user, piece.channel)) {
    return { error: 'Only a desk lead or admin can do this.' as const }
  }
  const assignments = await payload.find({
    collection: 'piece-assignments',
    where: { piece: { equals: pieceId } },
    limit: 1,
    overrideAccess: true,
  })
  const assignment = assignments.docs[0]
  if (!assignment) return { error: 'No assignment for this piece.' as const }
  return { payload, piece, assignment }
}
```

- [ ] **Step 3: Implement `approvePiece`**

```ts
export async function approvePiece(pieceId: string): Promise<{ error: string | null }> {
  const user = await requireUser()
  const loaded = await loadPieceAssignmentForLead(pieceId, user)
  if ('error' in loaded && loaded.error) return { error: loaded.error }
  const { payload, assignment } = loaded as Exclude<typeof loaded, { error: string }>

  if (assignment.status !== 'awaitingApproval') {
    return { error: 'This piece is not awaiting approval.' }
  }

  const verdicts = await payload.find({
    collection: 'qa-verdicts',
    where: { piece: { equals: pieceId } },
    sort: '-submittedAt',
    limit: 1,
    overrideAccess: true,
  })
  if (verdicts.docs[0]?.verdict !== 'goodToGo') {
    return { error: 'Latest verdict must be goodToGo before approval.' }
  }

  await payload.update({
    collection: 'piece-assignments',
    id: assignment.id,
    data: { status: 'approved' },
    overrideAccess: true,
  })

  revalidatePath(`/pieces/${pieceId}`)
  revalidatePath('/')
  return { error: null }
}
```

- [ ] **Step 4: Implement `sendBackPiece`**

Same load helper; require `awaitingApproval`; set status `inProgress`; revalidate.

- [ ] **Step 5: Implement `publishPiece`**

Require `assignment.status === 'approved'` and `!piece.publishedAt`. Map blocks:

```ts
const blocks = (piece.currentBody ?? piece.generatedSnapshot ?? []) as ContentBlock[]
const heading = blocks.find((b) => b.type === 'heading')
const paragraphs = blocks.filter((b) => b.type === 'paragraph').map((b) => b.text)
const result = await getCmsClient().createArticle({
  title: heading?.text ?? piece.channelName ?? piece.channel,
  description: '',
  paragraphs,
})
await payload.update({
  collection: 'generated-pieces',
  id: pieceId,
  data: { publishedAt: new Date().toISOString(), cmsPackageId: result.packageId },
  overrideAccess: true,
})
await payload.update({
  collection: 'piece-assignments',
  id: assignment.id,
  data: { status: 'published' },
  overrideAccess: true,
})
```

Check `CreateArticleInput` includes `description` — if not, omit it.

- [ ] **Step 6: Run helper tests again**

Run: `bun test src/lib/pieces/assignment-status.test.ts`

---

### Task 3: Piece stepper + lead action UI

**Files:**
- Create: `src/app/(dashboard)/pieces/[id]/PieceStepper.tsx`
- Create: `src/app/(dashboard)/pieces/[id]/LeadActions.tsx`
- Modify: `src/app/(dashboard)/pieces/[id]/page.tsx`
- Modify: `src/app/globals.css` (reuse `.brief-stepper` / `.brief-step` if already present)

**Interfaces:**
- Consumes: `stepFromStatus`, `canLeadActOnPiece`, actions from Task 2
- `PieceStepper({ current }: { current: PieceStepperStep })`
- `LeadActions({ pieceId, status, canLead, publishedAt }: { ... })`

- [ ] **Step 1: `PieceStepper`**

```tsx
const STEPS = [
  { id: 'edit', label: 'Edit' },
  { id: 'qa', label: 'QA' },
  { id: 'approve', label: 'Approve' },
  { id: 'publish', label: 'Publish' },
] as const
```

Mark current / done using order index vs `current`. Use existing `brief-stepper` class names.

- [ ] **Step 2: `LeadActions`**

Client component with three forms/`useActionState` buttons:

- When `status === 'awaitingApproval' && canLead`: Approve + Send back
- When `status === 'approved' && canLead && !publishedAt`: Publish to CMS
- When `publishedAt`: show “Published …” subtitle
- When `awaitingApproval && !canLead`: “Waiting for desk lead approval.”

- [ ] **Step 3: Wire `page.tsx`**

Load assignment for the piece (depth 0). Compute:

```ts
const status = (assignment?.status ?? 'claimed') as AssignmentStatus
const currentStep = stepFromStatus(status)
const canLead = canLeadActOnPiece(user, piece.channel)
```

Allow page view for assignee **or** lead/admin (today assignee-only may 403 via access — if `findByID` with `overrideAccess: false` blocks leads, load piece with lead check: if `canLeadActOnPiece` then `overrideAccess: true` for read). Spec requires leads to act on the page — **must** let leads open `/pieces/[id]` even when not assignee.

- [ ] **Step 4: Manual smoke** — with `bun dev`, open a piece as lead after goodToGo and confirm stepper + buttons.

---

### Task 4: Dashboard status labels (minimal)

**Files:**
- Modify: `src/app/(dashboard)/page.tsx` only if status badge needs friendlier labels

- [ ] **Step 1:** If the dashboard already renders `assignment.status` raw, map:

```ts
const STATUS_LABEL: Record<string, string> = {
  claimed: 'Claimed',
  inProgress: 'In progress',
  inQA: 'In QA',
  verdictReached: 'Verdict reached',
  awaitingApproval: 'Awaiting approval',
  approved: 'Approved',
  published: 'Published',
}
```

- [ ] **Step 2: Run full related tests**

Run: `bun test src/lib/pieces/assignment-status.test.ts src/payload/access/admin.test.ts`

---

## Spec coverage checklist

| Spec item | Task |
| --- | --- |
| New statuses on assignments | 1 |
| Verdict → awaitingApproval / inProgress | 2 |
| Approve / Send back / Publish actions + lead authz | 2 |
| Piece stepper Edit→QA→Approve→Publish | 3 |
| Lead can open piece page | 3 |
| Publish uses createArticle + publishedAt/cmsPackageId | 2 |
| No send-back note / no new collection | (explicit non-goals) |
| Dashboard shows new statuses | 4 |

## Placeholder scan

None intentional.
