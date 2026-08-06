import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { generatedPieceSchema, type GeneratedPieceBlocks } from './schema'

export interface GenerationSource {
  headline: string
  body: string
  agency?: string
}

export interface GenerationInput {
  topic: string
  language: string
  angle: string
  sentiment: string
  portrayalNotes: string
  requiredContext: string
  bannedTerms: string[]
  guidelineText: string | null
  sources: GenerationSource[]
}

/** Adapted from trt-editorial-n8n/trt-daily-editorial.json's "Generate Article" agent - same
 *  anti-AI-tell writing standards. Story-specific guidance comes straight from the brief-item
 *  (this app already collects it at parse time, unlike the prototype's separate Sheet-driven
 *  policyOverride); the desk's general OKF guideline supplements it. */
function buildSystemPrompt(input: GenerationInput): string {
  return `You are a TRT editorial writer producing one article for a brief topic, using the
wire sources below as research material (not as text to paraphrase wholesale).

STORY: ${input.topic}
LANGUAGE: write the entire output in ${input.language}.

STORY-SPECIFIC GUIDANCE (overrides general guidance on conflict):
- Angle: ${input.angle || 'none specified'}
- Sentiment: ${input.sentiment || 'none specified'}
- Portrayal notes: ${input.portrayalNotes || 'none specified'}
- Required context: ${input.requiredContext || 'none specified'}
- Banned terms (never use): ${input.bannedTerms.length > 0 ? input.bannedTerms.join(', ') : 'none'}

GENERAL DESK GUIDELINE:
${input.guidelineText ?? 'None provided.'}

WRITING STANDARDS:
- Open inside the story's key fact, not scene-setting.
- Vary sentence length. No paragraph over four sentences.
- Never use these AI-tell openings/transitions: "Imagine...", "Picture this...", "It's not just X
  but also Y", "At first glance... but look closer", "It's worth noting that...", "In conclusion...",
  "The takeaway here is...", "signifies a landmark moment".
- Synthesize across the sources; do not invent facts that none of them support.
- Weave quotes naturally into the narrative, don't just append them.

Return exactly one heading block (the headline) followed by paragraph blocks (the body).`
}

function buildSourcesPrompt(sources: GenerationSource[]): string {
  return sources
    .map((source, index) => {
      const agency = source.agency ? ` (${source.agency})` : ''
      return [
        `SOURCE ${index + 1}${agency}`,
        `HEADLINE: ${source.headline}`,
        `BODY:\n${source.body}`,
      ].join('\n')
    })
    .join('\n\n---\n\n')
}

export async function runGeneration(input: GenerationInput): Promise<GeneratedPieceBlocks> {
  const { object } = await generateObject({
    model: google('gemini-flash-lite-latest'),
    schema: generatedPieceSchema,
    system: buildSystemPrompt(input),
    prompt: buildSourcesPrompt(input.sources),
  })
  return object
}
