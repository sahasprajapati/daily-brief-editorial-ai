# trt-newsroom-ai

Standalone editorial AI pipeline: daily brief → provider collection → guideline-shaped generation → shared pool/claiming → editor review → OKF-based QA → publish to `trt-global-cms-prod`.

Not integrated into `trt-global-cms-prod` — talks to it only over its REST API, via `src/lib/cms-client`.

## Layout

- `src/` — Payload 3 + Next.js app: collections, admin UI, background jobs.
- `src/lib/cms-client` — typed client for the three calls this project makes into `trt-global-cms-prod`: list channels, search existing content (dedup), create the final article.
- `src/lib/provider-client` — unified, config-driven client over news providers (Event Registry today; add providers as data, add provider *types* as code).
- `src/lib/content-diff` — block-addressable content model + diff engine (built on `htmldiff-js`) so QA flags can point at a specific passage instead of "the document."
- `okf-ruleset` — the QA ruleset and per-desk guidelines, authored as a Google [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) bundle (markdown + YAML frontmatter, no SDK required).

## Requires

- Bun >= 1.3
- A MongoDB instance (or use `docker compose up -d` to start one)
- `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini, via `@ai-sdk/google`) — matches the LLM already used by the `trt-editorial-n8n` prototype and by `trt-global-cms-prod`.
- `EVENT_REGISTRY_API_KEY`
- `CMS_API_KEY` — a Payload API key for a single dedicated "AI account" service user in `trt-global-cms-prod`.

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Copy and fill in environment variables
cp .env.example .env
# TipTap Pro token is required to build the app image (payload-richtext-tiptap).
# Put TIPTAP_AUTH_TOKEN in .env (or export it) before docker compose build.

# 3. Start MongoDB + app (app on :3000, mongo on :27017)
docker compose up -d --build

# Or run the app locally against compose Mongo only:
# docker compose up -d mongodb
bun run dev
```
