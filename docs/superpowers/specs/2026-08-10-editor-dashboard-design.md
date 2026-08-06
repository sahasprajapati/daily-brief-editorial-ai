# Custom login + editor dashboard

## Problem

`trt-newsroom-ai` currently exposes only Payload's default `/admin` panel. There's no
way for an editor to log in and work the editorial queue (claim a generated piece,
edit it, submit a QA verdict) outside of raw collection CRUD in the admin UI. We want a
custom home screen, modeled loosely on `trt-global-cms-prod`'s split between a custom
app UI and the stock Payload admin.

## Scope

In scope:
- Custom `/login` page (native Payload email/password auth, not Keycloak — this app's
  `Users` collection uses `auth: true` directly).
- `/` dashboard: editor's work queue — unclaimed `generated-pieces`, claim action, "my
  pieces" grouped by assignment status.
- `/pieces/[id]` review page: view/edit `currentBody` blocks, diff against
  `generatedSnapshot`, submit a `qa-verdicts` doc.
- Narrowly scoped access-control changes so a logged-in editor can actually perform
  these writes (see below — currently everything is `adminOnly`).

Out of scope:
- Automated OKF QA runner (nothing in the codebase runs one yet; verdicts stay manual
  for v1).
- Admin-facing pipeline-health/monitoring view.
- Manager-assigns-to-editor flow (only self-claim).
- Notifications.
- Pulling in Tailwind/shadcn/framer-motion from `trt-global-cms-prod` — matched
  visually with plain CSS instead, since this app has no design-system dependency yet.

`/admin` is untouched and remains available for raw collection CRUD.

## Routes

- `/login` — client component form, adapted visually from
  `trt-global-cms-prod/src/app/(payload)/admin/login/page.tsx` (centered card, same
  field layout/copy tone), plain CSS instead of Tailwind/shadcn. Server action calls
  Payload's local API `payload.login()` and sets the `payload-token` cookie — no
  Keycloak, no manual JWT signing (cms-prod needs that because it authenticates against
  Keycloak; this app's Users are native Payload auth).
- `/` — server component dashboard. Reads session via `payload.auth({ headers })`;
  redirects to `/login` when there's no user.
- `/pieces/[id]` — server component review page, ownership-checked (see access control).

No new route groups beyond what already exists (`(payload)` for admin/api). This app
doesn't need cms-prod's `(app)`/`(payload)`/`(preview)` three-way split.

## Dashboard (`/`)

- **Unclaimed queue**: `generated-pieces` with no matching `piece-assignments` row.
  Each row shows channel + the linked `collected-items.headline`, with a Claim button.
- **Claim action**: server action creates a `piece-assignments` doc
  (`piece`, `assignedTo: currentUser`, default `status: 'claimed'`). The existing
  `assertClaimAvailable` hook plus the `piece` field's `unique: true` constraint already
  make this race-safe (per the comment in
  `src/payload/collections/piece-assignments/hooks/beforeChange.ts`) — no new locking
  needed.
- **My pieces**: `piece-assignments` where `assignedTo === currentUser`, grouped by
  `status` (`claimed` / `inProgress` / `inQA` / `verdictReached`), each linking to
  `/pieces/[id]`.

## Review page (`/pieces/[id]`)

- Loads the `generated-pieces` doc and its `piece-assignments` row; 403s (rendered as a
  not-authorized page) if the current user isn't the assignee.
- Renders `currentBody` (`ContentBlock[]`) as editable blocks (paragraph/heading).
- "View changes" toggle renders `diffBlockSnapshots(generatedSnapshot, currentBody)`
  from `src/lib/content-diff` — reuses the existing diff engine, no new one.
- Save action updates `generated-pieces.currentBody`.
- Verdict form: `verdict` select (`goodToGo` / `needsAttention` / `rejected`), optional
  per-block flags (`blockId`, `rule`, `severity`, `message`). Submitting creates a
  `qa-verdicts` doc (`piece`, `pieceBodySnapshot: currentBody`, `submittedBy: currentUser`,
  `submittedAt: now`) and updates the `piece-assignments.status` to `inQA`.

## Access control changes

Every collection's `create`/`update`/`delete` is currently `adminOnly`
(`src/payload/access/admin.ts`). As written, an editor role cannot claim a piece, edit
`currentBody`, or submit a verdict at all — this blocks the whole feature, not just the
UI. Loosen narrowly, keep `delete` `adminOnly` everywhere:

- `piece-assignments.create`: any authenticated user, provided `data.assignedTo` equals
  `req.user.id` (self-claim only; assigning others stays `adminOnly` — no
  manager-assigns flow in this design).
- `generated-pieces.update`: allowed if the requester has a `piece-assignments` row for
  that piece with `assignedTo === req.user.id`; otherwise `adminOnly`.
- `qa-verdicts.create`: same ownership check as above (must be the current assignee).

All three become `Access` functions (not `() => true`/`() => checkIsAdmin(...)`) added
next to the existing `adminOnly`/`checkIsAdmin` helpers in
`src/payload/access/admin.ts`, so the ownership-lookup logic lives in one place rather
than being duplicated per collection.

## Testing

- One `assertClaimAvailable`-style unit test isn't needed (it exists already) — add a
  small test for the new ownership `Access` functions: editor A can update a piece
  assigned to them, editor B (or no assignment) cannot, admin always can.
- Manual verification: log in as a seeded editor, claim a piece, edit it, submit a
  verdict, confirm `/admin` still shows everything unchanged for an admin login.
