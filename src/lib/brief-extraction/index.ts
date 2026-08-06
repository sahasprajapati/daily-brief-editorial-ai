import { runExtraction } from './gemini'
import type { ExtractedBriefItem } from './schema'

export class EmptyBriefError extends Error {
  constructor() {
    super('No topics found in this brief.')
    this.name = 'EmptyBriefError'
  }
}

export async function extractBrief(rawText: string): Promise<ExtractedBriefItem[]> {
  const result = await runExtraction(rawText)
  if (result.items.length === 0) {
    throw new EmptyBriefError()
  }
  return result.items
}

export type { ExtractedBrief, ExtractedBriefItem } from './schema'
