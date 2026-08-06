import { z } from 'zod'

export const extractedBriefItemSchema = z.object({
  topic: z.string(),
  /** Bold section header from the brief (e.g. "INTERNATIONAL NEWS", "GAZA & PALESTINE"). */
  sectionTitle: z.string().optional(),
  /** Piece format from the brief column (News, Video, Infographic, Op-Ed, Feature, …). */
  format: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  angle: z.string().default(''),
  priorityOrder: z.number(),
  region: z.string().optional(),
  exclusions: z.array(z.string()).default([]),
  sentiment: z.string().optional(),
  portrayalNotes: z.string().optional(),
  bannedTerms: z.array(z.string()).default([]),
  requiredContext: z.string().optional(),
})

export const extractedBriefSchema = z.object({
  items: z.array(extractedBriefItemSchema),
})

export type ExtractedBriefItem = z.infer<typeof extractedBriefItemSchema>
export type ExtractedBrief = z.infer<typeof extractedBriefSchema>
