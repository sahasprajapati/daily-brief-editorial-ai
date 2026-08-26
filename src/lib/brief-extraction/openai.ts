import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { extractedBriefSchema, type ExtractedBrief, type ExtractedBriefItem } from './schema'
import { isOpenAiStub } from '@/lib/openai-stub'

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
  if (isOpenAiStub()) {
    return stubExtraction(rawText)
  }
  const { object } = await generateObject({
    model: openai('gpt-4.1-mini'),
    schema: extractedBriefSchema,
    system: SYSTEM_PROMPT,
    prompt: rawText,
  })
  return object
}

// —— Stub mode (no OPENAI_API_KEY configured) ——
// Heuristic, non-AI parse of the same brief shape described in SYSTEM_PROMPT: ALL-CAPS /
// "## " lines are section headers, "Format: topic" or numbered lines are stories. Good
// enough to exercise upload → parse → sources → generate end-to-end without an OpenAI key.

const STUB_FORMAT_WORDS = ['News', 'Video', 'Infographic', 'Op-Ed', 'Op Ed', 'Feature', 'Analysis']

function isSectionHeader(line: string): boolean {
  if (line.startsWith('##')) return true
  if (line.length < 3 || line.length > 60) return false
  const letters = line.replace(/[^A-Za-z]/g, '')
  if (letters.length < 3) return false
  return line === line.toUpperCase() && /[A-Z]/.test(line)
}

function stripLeadingNumber(line: string): string {
  return line.replace(/^\s*\d+[.)]\s*/, '').trim()
}

function extractKeywords(text: string): string[] {
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ''))
    .filter((w) => w.length > 3)
  return Array.from(new Set(words)).slice(0, 5)
}

function stubExtraction(rawText: string): ExtractedBrief {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  // Briefs open with a title/date/desk line before the first section — when sections
  // exist, skip anything above the first one rather than treating it as a story.
  const hasSections = lines.some(isSectionHeader)

  const items: ExtractedBriefItem[] = []
  let sectionTitle: string | undefined
  let seenSection = false
  let order = 0

  for (const line of lines) {
    if (isSectionHeader(line)) {
      sectionTitle = line.replace(/^##\s*/, '').trim()
      seenSection = true
      continue
    }
    if (hasSections && !seenSection) continue

    let text = stripLeadingNumber(line)
    if (text.length < 8) continue // too short to be a real topic line — likely noise/header

    let format: string | undefined
    const formatWord = STUB_FORMAT_WORDS.find((word) => new RegExp(`^${word}\\s*[:|]\\s*`, 'i').test(text))
    if (formatWord) {
      format = formatWord
      text = text.replace(new RegExp(`^${formatWord}\\s*[:|]\\s*`, 'i'), '').trim()
    }
    if (!text) continue

    order += 1
    items.push({
      topic: text,
      sectionTitle,
      format,
      keywords: extractKeywords(text),
      angle: '',
      priorityOrder: order,
      exclusions: [],
      bannedTerms: [],
    })
  }

  return { items }
}
