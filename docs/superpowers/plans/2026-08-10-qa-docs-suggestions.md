# QA Docs-style Suggestions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Docs-like highlight → suggestion on pieces; persist on verdict; editor sees highlights + Text changed.

**Architecture:** Pure `resolveSuggestionAnchors` helper; client `ArticleAnnotator` for selection UX; `qa-verdicts.suggestions[]` schema; piece page loads latest verdict.

**Tech Stack:** Next.js 15, Payload 3, React, existing ContentBlock model.

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/qa-suggestions/types.ts` | Suggestion + resolved anchor types |
| `src/lib/qa-suggestions/resolve.ts` | Resolution algorithm |
| `src/lib/qa-suggestions/resolve.test.ts` | Unit tests |
| `src/payload/collections/qa-verdicts/index.ts` | Add `suggestions` field |
| `src/payload-types.ts` | Types for suggestions |
| `src/app/(dashboard)/pieces/[id]/ArticleAnnotator.tsx` | Document + select + composer + sidebar |
| `src/app/(dashboard)/pieces/[id]/ReviewForm.tsx` | Integrate annotator + edit mode |
| `src/app/(dashboard)/pieces/[id]/VerdictForm.tsx` | Pass suggestions into submit |
| `src/app/(dashboard)/pieces/[id]/actions.ts` | Persist suggestions |
| `src/app/(dashboard)/pieces/[id]/page.tsx` | Load latest verdict suggestions |
| `src/app/globals.css` | Highlight / sidebar styles |

## Tasks

### Task 1: Resolver + tests
### Task 2: Schema + submitVerdict
### Task 3: ArticleAnnotator UI
### Task 4: Wire piece page (QA compose + editor view of latest verdict)
