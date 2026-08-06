# Piece approve → publish (post-QA lead gate)

## Problem

After human QA, a `goodToGo` piece can already be published in the collection/generation
pipeline spec (`createArticle` + `publishedAt`). There is no **lead/admin sign-off** between
QA and publish, and `/pieces/[id]` has no stepper for that gate. Leads need **Approve** or
**Send back** before **Publish**.

## Decisions (locked)

- **Separate gate after QA** — QA `goodToGo` does not equal lead approval.
- **Actors** — Approve / Send back / Publish: **admin** or **desk lead** (`leadOfDesks`
  contains the piece’s `channel`). Editors see progress read-only.
- **UI home** — Per piece on `/pieces/[id]` (not brief workflow steps 4–5).
- **Send back** — Returns the piece to editor rework (`inProgress`); Approve stays locked
  until a new `goodToGo` verdict.
- **State model** — Approach A: extend `piece-assignments.status` only. No new
  `piece-approvals` collection; no extra lead-decision fields on `generated-pieces`
  beyond existing `publishedAt` / `cmsPackageId`.

## Status model

`piece-assignments.status` options become:

`claimed` | `inProgress` | `inQA` | `verdictReached` | `awaitingApproval` | `approved` | `published`

| Event | New status |
| --- | --- |
| Claim / editor editing | `claimed` / `inProgress` |
| Editor submits piece into QA queue (optional explicit handoff; today verdict submit is the handoff) | `inQA` while awaiting a verdict is acceptable; after verdict, leave `inQA` |
| Latest verdict `goodToGo` | `awaitingApproval` (`verdictReached` may be written transiently then advanced, or skipped — prefer **direct** `awaitingApproval`) |
| Latest verdict `needsAttention` / `rejected` | `inProgress` |
| Lead/admin Approve | `approved` |
| Lead/admin Send back | `inProgress` |
| Lead/admin Publish (only from `approved`) | `published` + set piece `publishedAt` / `cmsPackageId` |

**Invariant:** Publish is allowed only when assignment status is `approved` and
`publishedAt` is empty. Re-publish is out of scope.

**Invariant:** Approve is allowed only when status is `awaitingApproval` and the latest
`qa-verdicts` row is still `goodToGo` (defense in depth if body changed after verdict —
v1 does not re-check body hash; lead is expected to read the current body before approving).

## Piece page UI

Add a **piece stepper** at the top of `/pieces/[id]`:

1. **Edit** — assignee edits `currentBody` (existing `ReviewForm`).
2. **QA** — verdict + suggestions (existing `VerdictForm` / annotator).
3. **Approve** — lead/admin only actions when status is `awaitingApproval`.
4. **Publish** — lead/admin only when status is `approved`.

Current step is derived from assignment status (and whether `publishedAt` is set):

| Status | Current step |
| --- | --- |
| `claimed` / `inProgress` | Edit |
| `inQA` / `verdictReached` | QA |
| `awaitingApproval` | Approve |
| `approved` | Publish |
| `published` | Publish (done) |

**Approve step panel** (lead/admin): primary **Approve**, secondary **Send back** (optional
short note in the action payload is nice-to-have; v1 may omit persisted note since Approach A
has nowhere to store it without new fields — omit note for v1).

**Publish step panel** (lead/admin): **Publish to CMS** calling existing
`cms-client.createArticle()` mapping (`title` = first heading text, `description` = `''`,
paragraphs from body blocks) as already specified in the collection/generation pipeline
design. On success: set `cmsPackageId`, `publishedAt`, assignment → `published`.

Non-leads: stepper is visible; Approve/Publish buttons hidden; copy explains waiting on lead.

## Server actions

On `/pieces/[id]/actions.ts` (or adjacent):

- Fix/clarify `submitVerdict` status updates:
  - `goodToGo` → assignment `awaitingApproval`
  - `needsAttention` / `rejected` → `inProgress`
  - (Stop leaving every verdict at `inQA`.)
- `approvePiece(pieceId)` — authz lead/admin; require `awaitingApproval` + latest verdict
  `goodToGo`; set `approved`.
- `sendBackPiece(pieceId)` — authz lead/admin; require `awaitingApproval`; set `inProgress`.
- `publishPiece(pieceId)` — authz lead/admin; require `approved` + not yet published; CMS
  create; set piece publish fields + assignment `published`.

All revalidate `/pieces/[id]` and `/`.

## Access control

- Reuse `checkIsAdmin` / `isLeadOfDesk(user, piece.channel)` for the three lead actions
  (server-side in actions; do not rely on UI hiding alone).
- Assignees retain existing update rights for body/verdicts while status is Edit/QA.
- Leads/admins may update assignment status for Approve / Send back / Publish even when
  not the assignee (today `ownAssignmentUpdate` may block this — widen narrowly for
  status transitions by lead/admin, or perform those updates with a privileged path that
  still checks lead/admin in the action). Prefer: **action-level check +
  `overrideAccess: true` only after lead/admin verified**, matching other privileged
  pipeline actions if any; otherwise extend `piece-assignments` update access for
  lead-of-channel.

Dashboard “My pieces” grouping: include the new statuses in the existing groups (or add
Awaiting approval / Approved / Published buckets for leads — minimal change: show new
status labels in the same list).

## Out of scope

- Brief-level Approve/Publish stepper or bulk publish.
- Persisted send-back notes / approval audit collection.
- Re-publish / unpublish.
- Auto-publish on Approve.
- TipTap CSS isolation (separate track).

## Testing

- Unit: status transition helpers or action guards (goodToGo → awaitingApproval; Approve
  rejected for non-lead; Publish rejected unless `approved`).
- Manual: editor gets `goodToGo` → lead sees Approve → Approve → Publish → `publishedAt`
  set (or clear error if CMS env missing).

## Relationship to prior specs

- Supersedes the pipeline design’s “Publish button appears on `goodToGo`” for the
  **gate**: Publish now requires `approved`, not merely `goodToGo`.
- Keeps the same `createArticle` mapping and piece publish fields.
