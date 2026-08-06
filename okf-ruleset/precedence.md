---
type: "Policy"
title: "Guideline vs. OKF precedence"
status: "draft"
---

# When a guideline instructs something OKF forbids

**OKF hard-fail checks always win.** A desk's guideline can widen how a story is angled, whose voice
it centers, and what context it requires — but it cannot override a hard-fail check (e.g. a banned
term, a missing required disclosure). If a guideline and a hard-fail check disagree, the piece is
`rejected`, and the conflict itself gets flagged for the guideline owner to resolve editorially — not
silently decided in code.

**Soft-fail checks are advisory against the guideline.** A guideline can explicitly accept a soft-fail's
suggestion or override it; that decision is recorded on the piece (in `qa-verdicts.overrideJustification`),
not on the ruleset itself.

Status: draft — needs desk-lead sign-off before this bundle leaves the launch cohort.
