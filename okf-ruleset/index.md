---
type: "OKF Bundle"
title: "TRT Newsroom Editorial Ruleset"
description: "Per-desk editorial guidelines and the OKF QA checks generation and review run against."
okf_version: "0.2"
tags: ["editorial", "qa", "trt-newsroom-ai"]
---

# TRT Newsroom Editorial Ruleset

This bundle is the versioned source of truth for two things:

- **[guidelines/](/guidelines/index.md)** — how each desk wants a story written: sentiment, portrayal, required context, banned terms.
- **[checks/](/checks/index.md)** — the QA checks a generated or edited piece runs against before a verdict is issued.

See [precedence.md](/precedence.md) for what happens when a desk's guideline conflicts with an OKF check.

Authored directly by editors as markdown — no SDK, no database, just files. Plain markdown+frontmatter, per
Google's [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) v0.2 spec.
