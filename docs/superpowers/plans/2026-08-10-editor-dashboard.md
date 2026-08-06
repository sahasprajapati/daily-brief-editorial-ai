# Custom Login + Editor Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give editors a custom `/login` + `/` dashboard to claim, edit, and submit a QA verdict on generated pieces, without touching Payload's default `/admin`.

**Architecture:** A new `(dashboard)` Next.js route group (its own root layout, sibling to the existing `(payload)` group) holds `/login`, `/`, and `/pieces/[id]`. Pages are server components that call Payload's Local API directly (`getPayload({ config })`); mutations are React 19 Server Actions using `useActionState`, matching the pattern already used by `trt-global-cms-prod`'s login page. Every collection write currently requires `role === 'admin'` — three new ownership-scoped `Access` functions in `src/payload/access/admin.ts` let an editor act on their own claims without opening the collections up entirely.

**Tech Stack:** Next.js 15 App Router, React 19 (`useActionState`), Payload 3 Local API, `bun:test` for unit tests, plain CSS (no new dependencies).

## Global Constraints

- No new npm/bun dependencies (spec: match cms-prod's login page visually with plain CSS, not its Tailwind/shadcn/framer-motion stack).
- Every Local API call from a server action or access-control check that should be subject to access control MUST pass `overrideAccess: false` plus the acting `user` — Payload's Local API bypasses access control by default (`overrideAccess: true`), so forgetting this silently defeats every access function written in Task 1.
- Internal lookups performed *inside* an `Access` function (e.g. "does this user own the assignment for this piece?") MUST pass `overrideAccess: true` — otherwise the lookup recurses into access control and either infinite-loops or returns wrong results for a non-admin.
- `delete` stays `adminOnly` on every collection touched here — not in scope (spec: "keep `delete` `adminOnly` everywhere").
- `qa-verdicts.okfVersion` is a required field with no automated OKF runner behind it yet (spec: "Out of scope ... no automated OKF QA runner"). Use the constant `'manual'` for verdicts submitted through this UI.
- Path aliases already configured: `@/*` → `./src/*`, `@payload-config` → `./src/payload.config.ts`.

---

## File Structure

```
src/payload/access/admin.ts           (modify) - add selfClaimOnly, ownAssignmentUpdate,
                                                   ownAssignedPieceUpdate, ownAssignedVerdictCreate
src/payload/access/admin.test.ts      (create) - unit tests for the four functions above
src/payload/collections/piece-assignments/index.ts   (modify) - wire create/update access
src/payload/collections/generated-pieces/index.ts    (modify) - wire update access
src/payload/collections/qa-verdicts/index.ts         (modify) - wire create access

src/payload/auth/session.ts           (create) - getCurrentUser(), requireUser()

src/app/(dashboard)/layout.tsx        (create) - root layout (html/body), sibling to (payload)
src/app/(dashboard)/globals.css       (create) - plain CSS: card, form, button, list, diff styles

src/app/(dashboard)/login/page.tsx    (create) - login form (client component)
src/app/(dashboard)/login/actions.ts  (create) - login() server action

src/app/(dashboard)/page.tsx          (create) - dashboard: unclaimed queue + my pieces
src/app/(dashboard)/actions.ts        (create) - claimPiece() server action
src/app/(dashboard)/ClaimButton.tsx   (create) - client component wrapping claimPiece()

src/app/(dashboard)/pieces/[id]/page.tsx     (create) - review page, ownership-checked
src/app/(dashboard)/pieces/[id]/actions.ts   (create) - saveBody(), submitVerdict()
src/app/(dashboard)/pieces/[id]/ReviewForm.tsx  (create) - block editor + diff toggle + save
src/app/(dashboard)/pieces/[id]/VerdictForm.tsx (create) - verdict select + submit
```

---

### Task 1: Ownership-scoped access-control functions

**Files:**
- Modify: `src/payload/access/admin.ts`
- Test: `src/payload/access/admin.test.ts`

**Interfaces:**
- Consumes: `User` from `@/payload-types` (`{ id: string; role: 'admin' | 'editor' }`), `PayloadRequest`/`Access` from `payload`.
- Produces (used by Task 2):
  - `selfClaimOnly: Access` — for `piece-assignments.create`.
  - `ownAssignmentUpdate: Access` — for `piece-assignments.update`.
  - `ownAssignedPieceUpdate: Access` — for `generated-pieces.update`.
  - `ownAssignedVerdictCreate: Access` — for `qa-verdicts.create`.
  - (existing, unchanged) `checkIsAdmin`, `adminOnly`, `adminOnlyField`.

- [ ] **Step 1: Write the failing tests**

Create `src/payload/access/admin.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import type { PayloadRequest } from 'payload'
import type { User } from '@/payload-types'
import { ownAssignedPieceUpdate, ownAssignedVerdictCreate, ownAssignmentUpdate, selfClaimOnly } from './admin'

const admin = { id: 'admin-1', role: 'admin' } as User
const editor = { id: 'editor-1', role: 'editor' } as User
const otherEditor = { id: 'editor-2', role: 'editor' } as User

function fakeFind(matches: boolean) {
  return async () => ({ docs: matches ? [{ id: 'assignment-1' }] : [] }) as any
}

function fakeFindByID(assignedTo: string | null) {
  return async () => (assignedTo ? ({ id: 'assignment-1', assignedTo } as any) : null)
}

describe('selfClaimOnly', () => {
  test('admin can create an assignment for anyone', () => {
    const req = { user: admin } as PayloadRequest
    expect(selfClaimOnly({ req, data: { assignedTo: otherEditor.id } } as any)).toBe(true)
  })

  test('editor can create an assignment for themselves', () => {
    const req = { user: editor } as PayloadRequest
    expect(selfClaimOnly({ req, data: { assignedTo: editor.id } } as any)).toBe(true)
  })

  test('editor cannot create an assignment for someone else', () => {
    const req = { user: editor } as PayloadRequest
    expect(selfClaimOnly({ req, data: { assignedTo: otherEditor.id } } as any)).toBe(false)
  })

  test('logged-out request is denied', () => {
    const req = { user: null } as PayloadRequest
    expect(selfClaimOnly({ req, data: { assignedTo: editor.id } } as any)).toBe(false)
  })
})

describe('ownAssignmentUpdate', () => {
  test('admin can update any assignment', async () => {
    const req = { user: admin, payload: { findByID: fakeFindByID(otherEditor.id) } } as unknown as PayloadRequest
    expect(await ownAssignmentUpdate({ req, id: 'assignment-1' } as any)).toBe(true)
  })

  test('the assignee can update their own assignment', async () => {
    const req = { user: editor, payload: { findByID: fakeFindByID(editor.id) } } as unknown as PayloadRequest
    expect(await ownAssignmentUpdate({ req, id: 'assignment-1' } as any)).toBe(true)
  })

  test("another editor cannot update someone else's assignment", async () => {
    const req = { user: otherEditor, payload: { findByID: fakeFindByID(editor.id) } } as unknown as PayloadRequest
    expect(await ownAssignmentUpdate({ req, id: 'assignment-1' } as any)).toBe(false)
  })

  test('missing id is denied', async () => {
    const req = { user: editor, payload: { findByID: fakeFindByID(editor.id) } } as unknown as PayloadRequest
    expect(await ownAssignmentUpdate({ req } as any)).toBe(false)
  })
})

describe('ownAssignedPieceUpdate', () => {
  test('admin can always update', async () => {
    const req = { user: admin, payload: { find: fakeFind(false) } } as unknown as PayloadRequest
    expect(await ownAssignedPieceUpdate({ req, id: 'piece-1' } as any)).toBe(true)
  })

  test('the assignee can update their claimed piece', async () => {
    const req = { user: editor, payload: { find: fakeFind(true) } } as unknown as PayloadRequest
    expect(await ownAssignedPieceUpdate({ req, id: 'piece-1' } as any)).toBe(true)
  })

  test('a non-assignee cannot update the piece', async () => {
    const req = { user: otherEditor, payload: { find: fakeFind(false) } } as unknown as PayloadRequest
    expect(await ownAssignedPieceUpdate({ req, id: 'piece-1' } as any)).toBe(false)
  })
})

describe('ownAssignedVerdictCreate', () => {
  test('the assignee can submit a verdict for their piece', async () => {
    const req = { user: editor, payload: { find: fakeFind(true) } } as unknown as PayloadRequest
    expect(await ownAssignedVerdictCreate({ req, data: { piece: 'piece-1' } } as any)).toBe(true)
  })

  test('a non-assignee cannot submit a verdict', async () => {
    const req = { user: otherEditor, payload: { find: fakeFind(false) } } as unknown as PayloadRequest
    expect(await ownAssignedVerdictCreate({ req, data: { piece: 'piece-1' } } as any)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/payload/access/admin.test.ts`
Expected: FAIL — `selfClaimOnly`, `ownAssignmentUpdate`, `ownAssignedPieceUpdate`, `ownAssignedVerdictCreate` are not exported from `./admin`.

- [ ] **Step 3: Implement the access functions**

Replace the contents of `src/payload/access/admin.ts` with:

```ts
import type { Access, FieldAccess, PayloadRequest } from 'payload'
import type { User } from '@/payload-types'

/** No feature-permission matrix here (unlike trt-global-cms-prod) - this is a fresh app with
 *  two roles. Widen this only when a real second permission dimension shows up. */
export const checkIsAdmin = (user?: User | null): boolean => user?.role === 'admin'

export const adminOnly: Access = ({ req: { user } }) => checkIsAdmin(user as User | null)

export const adminOnlyField: FieldAccess = ({ req: { user } }) => checkIsAdmin(user as User | null)

/** Self-claim only: an authenticated user may create a piece-assignment for themselves,
 *  never for someone else - assigning other editors stays adminOnly (no manager-assigns
 *  flow in this app yet). */
export const selfClaimOnly: Access = ({ req: { user }, data }) => {
  const typedUser = user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!typedUser) return false
  return data?.assignedTo === typedUser.id
}

/** True only if the requesting user is the assignedTo on this piece-assignments doc.
 *  overrideAccess: true on the lookup avoids recursing back into this same check. */
export const ownAssignmentUpdate: Access = async ({ req, id }) => {
  const typedUser = req.user as User | null
  if (checkIsAdmin(typedUser)) return true
  if (!typedUser || !id) return false

  const assignment = await req.payload.findByID({
    collection: 'piece-assignments',
    id,
    overrideAccess: true,
  })

  return assignment?.assignedTo === typedUser.id
}

/** True only if the requesting user holds the piece-assignment for this generated-piece.
 *  Does one extra query per check - fine at this app's scale, revisit with a cached
 *  lookup if the pieces list grows large enough to matter. */
const isAssignedToPiece = async (req: PayloadRequest, pieceId: unknown): Promise<boolean> => {
  const typedUser = req.user as User | null
  if (!typedUser || !pieceId) return false

  const assignments = await req.payload.find({
    collection: 'piece-assignments',
    where: { and: [{ piece: { equals: pieceId } }, { assignedTo: { equals: typedUser.id } }] },
    limit: 1,
    overrideAccess: true,
  })

  return assignments.docs.length > 0
}

export const ownAssignedPieceUpdate: Access = async ({ req, id }) => {
  if (checkIsAdmin(req.user as User | null)) return true
  return isAssignedToPiece(req, id)
}

export const ownAssignedVerdictCreate: Access = async ({ req, data }) => {
  if (checkIsAdmin(req.user as User | null)) return true
  return isAssignedToPiece(req, data?.piece)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/payload/access/admin.test.ts`
Expected: PASS, all 12 tests.

- [ ] **Step 5: Type-check**

Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/payload/access/admin.ts src/payload/access/admin.test.ts
git commit -m "feat: add ownership-scoped access control for editor claims"
```

---

### Task 2: Wire access functions into the three collections

**Files:**
- Modify: `src/payload/collections/piece-assignments/index.ts`
- Modify: `src/payload/collections/generated-pieces/index.ts`
- Modify: `src/payload/collections/qa-verdicts/index.ts`

**Interfaces:**
- Consumes: `selfClaimOnly`, `ownAssignmentUpdate`, `ownAssignedPieceUpdate`, `ownAssignedVerdictCreate` from `../../access/admin` (Task 1).
- Produces: nothing new — this task only changes which `Access` function each collection's `create`/`update` points to. `read` stays `() => true` and `delete` stays `adminOnly` everywhere, unchanged.

- [ ] **Step 1: Update `piece-assignments`**

In `src/payload/collections/piece-assignments/index.ts`, change the import and `access` block:

```ts
import { adminOnly, ownAssignmentUpdate, selfClaimOnly } from '../../access/admin'
```

```ts
  access: {
    read: () => true,
    create: selfClaimOnly,
    update: ownAssignmentUpdate,
    delete: adminOnly,
  },
```

- [ ] **Step 2: Update `generated-pieces`**

In `src/payload/collections/generated-pieces/index.ts`, change the import and `access` block:

```ts
import { adminOnly, ownAssignedPieceUpdate } from '../../access/admin'
```

```ts
  access: {
    read: () => true,
    create: adminOnly,
    update: ownAssignedPieceUpdate,
    delete: adminOnly,
  },
```

- [ ] **Step 3: Update `qa-verdicts`**

In `src/payload/collections/qa-verdicts/index.ts`, change the import and `access` block:

```ts
import { adminOnly, ownAssignedVerdictCreate } from '../../access/admin'
```

```ts
  access: {
    read: () => true,
    create: ownAssignedVerdictCreate,
    update: adminOnly,
    delete: adminOnly,
  },
```

- [ ] **Step 4: Type-check and regenerate types**

Run: `bun run check-types`
Expected: no errors.

Run: `bun run generate:types`
Expected: succeeds, `src/payload-types.ts` unchanged (access functions don't affect the generated schema/types).

- [ ] **Step 5: Commit**

```bash
git add src/payload/collections/piece-assignments/index.ts \
        src/payload/collections/generated-pieces/index.ts \
        src/payload/collections/qa-verdicts/index.ts
git commit -m "feat: let editors claim, update, and QA their own pieces"
```

---

### Task 3: Session helper + dashboard route-group shell

**Files:**
- Create: `src/payload/auth/session.ts`
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/globals.css`

**Interfaces:**
- Consumes: `getPayload` from `payload`, `configPromise` from `@payload-config`, `User` from `@/payload-types`.
- Produces (used by every later task):
  - `getCurrentUser(): Promise<User | null>`
  - `requireUser(): Promise<User>` — redirects to `/login` if there's no session.

- [ ] **Step 1: Create the session helper**

Create `src/payload/auth/session.ts`:

```ts
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { User } from '@/payload-types'

export async function getCurrentUser(): Promise<User | null> {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })
  return user as User | null
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
```

- [ ] **Step 2: Create the dashboard route group layout**

Create `src/app/(dashboard)/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import './globals.css'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Create the stylesheet**

Create `src/app/(dashboard)/globals.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f3f4f6;
  color: #111827;
}

a {
  color: #3a6fb8;
}

.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 2rem;
}

.center-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.center-page .card {
  width: 100%;
  max-width: 28rem;
}

h1 {
  font-size: 1.25rem;
  margin: 0 0 0.5rem;
}

.subtitle {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0 0 1.5rem;
}

label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
}

input[type='email'],
input[type='password'],
input[type='text'],
select,
textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  margin-bottom: 1rem;
}

textarea {
  min-height: 6rem;
  font-family: inherit;
}

button {
  width: 100%;
  padding: 0.75rem;
  background: #4c89d0;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: -0.5rem;
  margin-bottom: 1rem;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item button {
  width: auto;
  padding: 0.5rem 1rem;
}

.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  background: #e5e7eb;
  font-size: 0.75rem;
  font-weight: 600;
}

.diff-added {
  background: #ecfdf5;
}

.diff-removed {
  background: #fef2f2;
  text-decoration: line-through;
}

.diff-changed ins {
  background: #d1fae5;
  text-decoration: none;
}

.diff-changed del {
  background: #fee2e2;
}
```

- [ ] **Step 4: Type-check**

Run: `bun run check-types`
Expected: no errors. (`/` and `/login` don't have `page.tsx` yet, so nothing renders yet — that's Tasks 4-5.)

- [ ] **Step 5: Commit**

```bash
git add src/payload/auth/session.ts "src/app/(dashboard)/layout.tsx" "src/app/(dashboard)/globals.css"
git commit -m "feat: add session helper and dashboard route-group shell"
```

---

### Task 4: Login page + server action

**Files:**
- Create: `src/app/(dashboard)/login/actions.ts`
- Create: `src/app/(dashboard)/login/page.tsx`

**Interfaces:**
- Consumes: `getPayload`/`configPromise` (Local API login), `cookies` from `next/headers`.
- Produces: nothing consumed by later tasks (Task 5's dashboard reaches `/login` only via `requireUser()`'s redirect from Task 3).

- [ ] **Step 1: Write the login server action**

Create `src/app/(dashboard)/login/actions.ts`:

```ts
'use server'

import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export type LoginState = { error: string | null }

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { error: 'Enter your email and password.' }
  }

  const payload = await getPayload({ config: configPromise })

  try {
    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    })

    if (!result.token || !result.exp) {
      return { error: 'Invalid email or password.' }
    }

    ;(await cookies()).set('payload-token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(result.exp * 1000),
    })
  } catch {
    return { error: 'Invalid email or password.' }
  }

  return { error: null }
}
```

- [ ] **Step 2: Write the login page**

Create `src/app/(dashboard)/login/page.tsx`:

```tsx
'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { login, type LoginState } from './actions'

const initialState: LoginState = { error: null }

export default function LoginPage() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(login, initialState)

  useEffect(() => {
    if (!isPending && state.error === null && state !== initialState) {
      router.replace('/')
      router.refresh()
    }
  }, [state, isPending, router])

  return (
    <div className="center-page">
      <div className="card">
        <h1>TRT Newsroom AI</h1>
        <p className="subtitle">Sign in to review and claim pieces.</p>

        <form action={formAction}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username" />

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />

          <button type="submit" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>

          {state.error && <p className="error">{state.error}</p>}
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 4: Manual verification**

1. Ensure MongoDB is running (`docker compose up -d`) and `.env` has `PAYLOAD_SECRET` set.
2. Run: `bun run dev`
3. Visit `http://localhost:3000/admin` and create the first user if none exists yet; set their `role` to `editor` (or `admin`) via the admin UI.
4. Visit `http://localhost:3000/login`, submit wrong credentials → see "Invalid email or password." with no redirect.
5. Submit correct credentials → redirected to `/` (a 404 or blank page is fine here — `page.tsx` for `/` doesn't exist until Task 5. What matters is the redirect happens and a `payload-token` cookie is set — check DevTools → Application → Cookies).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/login"
git commit -m "feat: add custom login page"
```

---

### Task 5: Dashboard page (unclaimed queue + my pieces) + claim action

**Files:**
- Create: `src/app/(dashboard)/actions.ts`
- Create: `src/app/(dashboard)/ClaimButton.tsx`
- Create: `src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `requireUser` (Task 3), `GeneratedPiece`/`PieceAssignment`/`CollectedItem` from `@/payload-types`.
- Produces: `claimPiece(pieceId: string): Promise<{ error: string | null }>`, used only by `ClaimButton.tsx` in this task.

- [ ] **Step 1: Write the claim server action**

Create `src/app/(dashboard)/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'

export async function claimPiece(pieceId: string): Promise<{ error: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    await payload.create({
      collection: 'piece-assignments',
      data: {
        piece: pieceId,
        assignedTo: user.id,
        status: 'claimed',
        claimedAt: new Date().toISOString(),
      },
      overrideAccess: false,
      user,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not claim this piece.' }
  }

  revalidatePath('/')
  return { error: null }
}
```

- [ ] **Step 2: Write the claim button**

Create `src/app/(dashboard)/ClaimButton.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { claimPiece } from './actions'

type ClaimState = { error: string | null }

const initialState: ClaimState = { error: null }

export function ClaimButton({ pieceId }: { pieceId: string }) {
  const [state, formAction, isPending] = useActionState<ClaimState, FormData>(
    () => claimPiece(pieceId),
    initialState,
  )

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending}>
        {isPending ? 'Claiming…' : 'Claim'}
      </button>
      {state.error && <p className="error">{state.error}</p>}
    </form>
  )
}
```

- [ ] **Step 3: Write the dashboard page**

Create `src/app/(dashboard)/page.tsx`:

```tsx
import Link from 'next/link'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import type { CollectedItem, GeneratedPiece, PieceAssignment } from '@/payload-types'
import { ClaimButton } from './ClaimButton'

function pieceLabel(piece: GeneratedPiece): string {
  const collectedItem = piece.collectedItem as CollectedItem
  const headline = typeof collectedItem === 'object' ? collectedItem.headline : null
  return `${headline ?? 'Untitled'} — ${piece.channelName ?? piece.channel}`
}

export default async function DashboardPage() {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  const [allPieces, allAssignments, myAssignments] = await Promise.all([
    payload.find({
      collection: 'generated-pieces',
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
      depth: 1,
      overrideAccess: false,
      user,
    }),
  ])

  const claimedPieceIds = new Set(
    allAssignments.docs.map((assignment) =>
      typeof assignment.piece === 'string' ? assignment.piece : assignment.piece.id,
    ),
  )
  const unclaimedPieces = allPieces.docs.filter((piece) => !claimedPieceIds.has(piece.id))

  return (
    <div className="page">
      <h1>TRT Newsroom AI</h1>
      <p className="subtitle">Signed in as {user.email}</p>

      <div className="card">
        <h2>Unclaimed pieces</h2>
        {unclaimedPieces.length === 0 ? (
          <p>Nothing waiting right now.</p>
        ) : (
          <ul className="list">
            {unclaimedPieces.map((piece) => (
              <li key={piece.id} className="list-item">
                <span>{pieceLabel(piece)}</span>
                <ClaimButton pieceId={piece.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2>My pieces</h2>
        {myAssignments.docs.length === 0 ? (
          <p>You haven&apos;t claimed anything yet.</p>
        ) : (
          <ul className="list">
            {myAssignments.docs.map((assignment: PieceAssignment) => {
              const piece = assignment.piece as GeneratedPiece
              return (
                <li key={assignment.id} className="list-item">
                  <span>{typeof piece === 'object' ? pieceLabel(piece) : piece}</span>
                  <span>
                    <span className="badge">{assignment.status}</span>{' '}
                    <Link href={`/pieces/${typeof piece === 'object' ? piece.id : piece}`}>Open</Link>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 5: Manual verification**

1. `bun run dev`, log in at `/login` as an editor.
2. Confirm you land on `/` and see any existing `generated-pieces` under "Unclaimed pieces" (create one via `/admin` if the collection is empty, along with its `collected-items`/`brief-items`/`editorial-briefs` chain — or a minimal `generated-pieces` doc directly, since `collectedItem` just needs to point at *some* existing `collected-items` doc).
3. Click "Claim" → the piece disappears from "Unclaimed pieces" and appears under "My pieces" with status `claimed`.
4. Open `/admin` → `piece-assignments` in a different browser/incognito session logged in as a *different* editor, confirm they cannot see this piece as claimable by them via a second claim attempt (POST to the same piece via `/admin` create should now 403 — Task 1/2's `selfClaimOnly` and the collection's existing unique-piece constraint both block it).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/actions.ts" "src/app/(dashboard)/ClaimButton.tsx" "src/app/(dashboard)/page.tsx"
git commit -m "feat: add dashboard with unclaimed queue and claim action"
```

---

### Task 6: Review page — view/edit blocks + diff toggle + save action

**Files:**
- Create: `src/app/(dashboard)/pieces/[id]/actions.ts` (this task adds `saveBody`; Task 7 adds `submitVerdict` to the same file)
- Create: `src/app/(dashboard)/pieces/[id]/ReviewForm.tsx`
- Create: `src/app/(dashboard)/pieces/[id]/page.tsx`

**Interfaces:**
- Consumes: `requireUser` (Task 3), `ContentBlock`/`diffBlockSnapshots` from `@/lib/content-diff`.
- Produces: `saveBody(pieceId: string, blocks: ContentBlock[]): Promise<{ error: string | null }>`, `ReviewForm` props `{ pieceId: string; initialBlocks: ContentBlock[]; diffEntries: BlockDiffEntry[] }`. Task 7 imports `ContentBlock` type from here indirectly (it re-imports from `@/lib/content-diff` itself, not from this file).

- [ ] **Step 1: Write the save-body server action**

Create `src/app/(dashboard)/pieces/[id]/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import type { ContentBlock } from '@/lib/content-diff'

export async function saveBody(pieceId: string, blocks: ContentBlock[]): Promise<{ error: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    await payload.update({
      collection: 'generated-pieces',
      id: pieceId,
      data: { currentBody: blocks },
      overrideAccess: false,
      user,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save this piece.' }
  }

  revalidatePath(`/pieces/${pieceId}`)
  return { error: null }
}
```

- [ ] **Step 2: Write the review form**

Create `src/app/(dashboard)/pieces/[id]/ReviewForm.tsx`:

```tsx
'use client'

import { useActionState, useState } from 'react'
import type { BlockDiffEntry, ContentBlock } from '@/lib/content-diff'
import { saveBody } from './actions'

type SaveState = { error: string | null }

const initialState: SaveState = { error: null }

export function ReviewForm({
  pieceId,
  initialBlocks,
  diffEntries,
}: {
  pieceId: string
  initialBlocks: ContentBlock[]
  diffEntries: BlockDiffEntry[]
}) {
  const [showDiff, setShowDiff] = useState(false)
  const [blocks, setBlocks] = useState(initialBlocks)
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    () => saveBody(pieceId, blocks),
    initialState,
  )

  return (
    <div className="card">
      <button type="button" onClick={() => setShowDiff((value) => !value)}>
        {showDiff ? 'Hide changes' : 'View changes'}
      </button>

      {showDiff ? (
        <ul className="list" style={{ marginTop: '1rem' }}>
          {diffEntries.map((entry) => (
            <li key={entry.blockId} className={`list-item diff-${entry.status}`}>
              {entry.status === 'changed' && entry.diffHtml ? (
                <span dangerouslySetInnerHTML={{ __html: entry.diffHtml }} />
              ) : (
                <span>{entry.text}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <form action={formAction} style={{ marginTop: '1rem' }}>
          {blocks.map((block, index) => (
            <textarea
              key={block.blockId}
              value={block.text}
              onChange={(event) => {
                const next = [...blocks]
                next[index] = { ...block, text: event.target.value }
                setBlocks(next)
              }}
            />
          ))}
          <button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </button>
          {state.error && <p className="error">{state.error}</p>}
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write the review page**

Create `src/app/(dashboard)/pieces/[id]/page.tsx`:

`payload.findByID` with `overrideAccess: false` throws (rather than returning `null`) when access is denied, so the call needs a try/catch to turn a non-assignee's request into a clean "not found" instead of an unhandled 500:

```tsx
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireUser } from '@/payload/auth/session'
import { diffBlockSnapshots, type ContentBlock } from '@/lib/content-diff'
import { ReviewForm } from './ReviewForm'

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

  return (
    <div className="page">
      <h1>{piece.channelName ?? piece.channel}</h1>
      <p className="subtitle">{piece.attributionString}</p>

      <ReviewForm pieceId={piece.id} initialBlocks={currentBody} diffEntries={diffEntries} />
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 5: Manual verification**

1. `bun run dev`, log in as the editor who claimed a piece in Task 5.
2. From `/`, click "Open" on that piece under "My pieces" → lands on `/pieces/<id>` showing its blocks in editable textareas.
3. Edit some text, click "Save" → no error shown; reload the page → the edited text persists.
4. Click "View changes" → toggles to the diff list (word-level highlight if `generatedSnapshot` differs from the saved `currentBody`).
5. Log in as a *different* editor who has not claimed this piece, visit `/pieces/<id>` directly → see Next.js's not-found page (confirms `ownAssignedPieceUpdate`... actually confirms the read-side 403 handling; the write-side ownership check from Task 1 is what actually blocks the save if this guard were ever bypassed).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/pieces"
git commit -m "feat: add piece review page with block editing and diff view"
```

---

### Task 7: Verdict form + submit action

**Files:**
- Modify: `src/app/(dashboard)/pieces/[id]/actions.ts` (add `submitVerdict`)
- Create: `src/app/(dashboard)/pieces/[id]/VerdictForm.tsx`
- Modify: `src/app/(dashboard)/pieces/[id]/page.tsx` (render `VerdictForm`)

**Interfaces:**
- Consumes: `ContentBlock` from `@/lib/content-diff`, `requireUser` (Task 3).
- Produces: `submitVerdict(pieceId: string, verdict: 'goodToGo' | 'needsAttention' | 'rejected'): Promise<{ error: string | null }>`.

- [ ] **Step 1: Add the submit-verdict server action**

Append to `src/app/(dashboard)/pieces/[id]/actions.ts`:

```ts
const MANUAL_VERDICT_OKF_VERSION = 'manual'

export async function submitVerdict(
  pieceId: string,
  verdict: 'goodToGo' | 'needsAttention' | 'rejected',
): Promise<{ error: string | null }> {
  const user = await requireUser()
  const payload = await getPayload({ config: configPromise })

  try {
    const piece = await payload.findByID({
      collection: 'generated-pieces',
      id: pieceId,
      overrideAccess: false,
      user,
    })
    const currentBody = (piece.currentBody ?? piece.generatedSnapshot ?? []) as ContentBlock[]

    await payload.create({
      collection: 'qa-verdicts',
      data: {
        piece: pieceId,
        pieceBodySnapshot: currentBody,
        verdict,
        okfVersion: MANUAL_VERDICT_OKF_VERSION,
        submittedBy: user.id,
        submittedAt: new Date().toISOString(),
      },
      overrideAccess: false,
      user,
    })

    const assignments = await payload.find({
      collection: 'piece-assignments',
      where: { piece: { equals: pieceId } },
      limit: 1,
      overrideAccess: false,
      user,
    })
    const assignment = assignments.docs[0]
    if (assignment) {
      await payload.update({
        collection: 'piece-assignments',
        id: assignment.id,
        data: { status: 'inQA' },
        overrideAccess: false,
        user,
      })
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not submit this verdict.' }
  }

  revalidatePath(`/pieces/${pieceId}`)
  revalidatePath('/')
  return { error: null }
}
```

- [ ] **Step 2: Write the verdict form**

Create `src/app/(dashboard)/pieces/[id]/VerdictForm.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { submitVerdict } from './actions'

type VerdictState = { error: string | null }

const initialState: VerdictState = { error: null }

export function VerdictForm({ pieceId }: { pieceId: string }) {
  const [state, formAction, isPending] = useActionState<VerdictState, FormData>(async (_prev, formData) => {
    const verdict = formData.get('verdict') as 'goodToGo' | 'needsAttention' | 'rejected'
    return submitVerdict(pieceId, verdict)
  }, initialState)

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h2>Submit verdict</h2>
      <form action={formAction}>
        <label htmlFor="verdict">Verdict</label>
        <select id="verdict" name="verdict" required defaultValue="">
          <option value="" disabled>
            Choose one
          </option>
          <option value="goodToGo">Good to go</option>
          <option value="needsAttention">Needs attention</option>
          <option value="rejected">Rejected</option>
        </select>

        <button type="submit" disabled={isPending}>
          {isPending ? 'Submitting…' : 'Submit verdict'}
        </button>
        {state.error && <p className="error">{state.error}</p>}
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Render it on the review page**

In `src/app/(dashboard)/pieces/[id]/page.tsx`, import and render `VerdictForm` below `ReviewForm`:

```tsx
import { VerdictForm } from './VerdictForm'
```

```tsx
      <ReviewForm pieceId={piece.id} initialBlocks={currentBody} diffEntries={diffEntries} />
      <VerdictForm pieceId={piece.id} />
```

- [ ] **Step 4: Type-check**

Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 5: Manual verification**

1. `bun run dev`, log in as the editor who claimed and edited the piece from Task 6.
2. On `/pieces/<id>`, pick a verdict (e.g. "Good to go") and submit → no error shown.
3. Open `/admin` → `qa-verdicts` as an admin, confirm a new doc exists with `piece` pointing at this piece, `verdict: goodToGo`, `okfVersion: manual`, `submittedBy` set to the editor.
4. Open `/admin` → `piece-assignments`, confirm that assignment's `status` is now `inQA`.
5. Back on `/`, confirm the piece's badge under "My pieces" now reads `inQA`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/pieces/[id]/actions.ts" "src/app/(dashboard)/pieces/[id]/VerdictForm.tsx" "src/app/(dashboard)/pieces/[id]/page.tsx"
git commit -m "feat: add QA verdict submission to the review page"
```
