# NewsHQ brief source review — design

**Date:** 2026-08-10

## Goal

After a brief is confirmed, editors search TRT NewsHQ for related wire copy per topic, review hits, keep selected sources, and optionally generate drafts per chosen article — not auto-generate everything.

## Decisions

- **When:** After confirm → Start collection (option B).
- **After pick:** Keep and/or Generate per hit (option C).
- **Provider:** NewsHQ only for this flow.
- **Config:** Global NewsHQ settings (not per-channel), editable in Payload + dashboard `/settings/newshq`.
- **Option lists:** Loaded from `GET {NEWS_HQ_SEARCH_BASE_URL}/api/v1/news/filters` (agencies, priorities, languages).
- **Defaults:** priorities `1,2,3,4`; agencies all from filters until narrowed in settings; limit 20.
- **Base URL:** from env `NEWS_HQ_SEARCH_BASE_URL` (host); app appends `/api/v1/news` and `/api/v1/news/filters`.

## Flow

1. Confirm brief.
2. Start collection → NewsHQ search per pending brief-item (keywords, else topic).
3. Persist hits as collected-items with `reviewStatus: candidate`.
4. Brief page lists candidates under each topic.
5. Editor Keep → `reviewStatus: kept`. Generate → draft from that item (marks kept if still candidate).

## Data

- Global `news-hq-settings`: agencies[], priorities[], defaultLang, limit.
- `collected-items.reviewStatus`: `candidate` | `kept`.
