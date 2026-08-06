---
type: "QA Check"
title: "No banned terms"
description: "Flags any of the brief's banned/discouraged terms appearing in the piece."
severity: "hardFail"
status: "stable"
tags: ["portrayal", "language"]
---

# No banned terms

Fails the piece if it contains any term listed in the matching brief item's `bannedTerms`.

**Example, from a real brief** (`trt-editorial-n8n/sample-brief.txt`, EU migration item): banned
terms `"illegal migrants"`, `"flood"`, `"wave"` (of migrants) — use `"undocumented migrants"` or
`"asylum seekers"` depending on status instead.

**On trip:** flag the exact block containing the term (`blockId`, not the whole piece) with the
banned term quoted in the message.
