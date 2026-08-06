import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { extractedBriefSchema, type ExtractedBrief } from './schema'

/** Adapted from the proven prompt in trt-editorial-n8n/trt-daily-editorial.json's "Extract
 *  Brief" node - extended for TRT daily briefs that use bold section titles + format columns
 *  (see TRT_Russian_Brief sample: INTERNATIONAL NEWS / News|Video|Op-Ed rows). */
const SYSTEM_PROMPT = `You are extracting structured data from a TRT newsroom daily editorial brief.

Document shape (common for digital-team briefs):
- Header: desk name, date, team
- Bold section titles as markdown "## SECTION" (e.g. INTERNATIONAL NEWS, RUSSIA–UKRAINE,
  GAZA & PALESTINE, WAR ZONES, ECONOMY, VIDEO, INFOGRAPHIC, OP-ED / FEATURE)
- Under each section: numbered rows with format (News, Video, Infographic, Op-Ed, Feature)
  and a headline/topic. Numbering often restarts per section.

Rules:
- Each topic is one distinct story (use the headline as topic).
- sectionTitle: copy the nearest preceding section header exactly (without "## ").
- format: copy the format column value when present (News, Video, …).
- priorityOrder: overall document order starting at 1 (do NOT restart per section).
- keywords: useful search terms for finding related coverage.
- angle / sentiment / portrayalNotes / bannedTerms / requiredContext / exclusions / region:
  only fill when the brief actually states guidance. Many briefs are headline lists only —
  leave those fields empty rather than inventing editorial policy.
- Do not invent topics that are not in the brief.`

export async function runExtraction(rawText: string): Promise<ExtractedBrief> {
  const { object } = await generateObject({
    model: google('gemini-flash-lite-latest'),
    schema: extractedBriefSchema,
    system: SYSTEM_PROMPT,
    prompt: rawText,
  })
  return object
}
