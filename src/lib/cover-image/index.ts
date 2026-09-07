import { generateCoverImageOpenAi } from './openai'
import type { ImageRatio } from './ratio'
import type { GeneratedCoverImage } from './types'

export type { GeneratedCoverImage } from './types'
export { RATIO_LABEL, type ImageRatio } from './ratio'

/** Base editorial shape/style directive, always layered onto every cover image generation —
 *  kept out of band from the editor's free-text prompt (same "base + specific" pattern as
 *  joinChannelInstructions) so the rule survives edits, regeneration, and pieces created before
 *  this rule existed, instead of living only inside a "default" the editor can type over.
 *  Deliberately avoids the literal words "square"/"portrait"/etc — resolveImageSize (openai.ts)
 *  scans the *whole* final prompt for those as an explicit-override signal, and this directive
 *  is part of every prompt, so using the words here (even to negate them, e.g. "never square")
 *  would trip that same override on every single generation. */
export const IMAGE_STYLE_INSTRUCTIONS =
  'Photojournalistic editorial news cover image, wide landscape composition sized for a website ' +
  'article header / hero banner - horizontal, never a boxy or tall crop, unless the prompt above ' +
  'explicitly asks for a different shape - realistic, no text or logos overlaid on the image.'

/** Combines the editor's article-specific subject prompt with the channel's general image
 *  instructions (see channel-configs.extraImageInstructions — "never depict [person]" etc.,
 *  set once on the Instructions settings page, not re-typed per article) and the base style
 *  directive above. Idempotent — calling it again on an already-combined prompt (e.g.
 *  regenerating from a piece's saved coverImagePrompt) won't duplicate either. */
export function buildCoverImagePrompt(subjectPrompt: string, extraInstructions?: string): string {
  const subject = subjectPrompt.trim()
  const extra = extraInstructions?.trim()

  if (subject.includes(IMAGE_STYLE_INSTRUCTIONS)) {
    // Already composed (regenerating) - only the channel instructions might have changed since.
    if (extra && !subject.includes(extra)) return `${subject} ${extra}`
    return subject
  }

  const parts = [subject, extra, IMAGE_STYLE_INSTRUCTIONS].filter(Boolean)
  return parts.join('. ')
}

/** Builds a sensible default prompt from the article headline when the editor hasn't
 *  written one — still editable before generating. Includes the style directive (and the
 *  channel's general image instructions, if any) up front so they're visible immediately, not
 *  just applied invisibly at generation time. */
export function defaultCoverImagePrompt(headline: string, extraInstructions?: string): string {
  return buildCoverImagePrompt(headline, extraInstructions)
}

/** Single entry point for cover image generation — today this only calls the OpenAI
 *  placeholder provider, but callers only depend on this function, so swapping in Atlas AI
 *  (or any other provider) later is a change to this file alone. Always layers the channel's
 *  general image instructions and the base style directive onto whatever prompt the caller
 *  passes (see buildCoverImagePrompt), and the composed prompt — not just the caller's raw
 *  text — is what gets persisted as generated-pieces.coverImagePrompt, so it stays visible on
 *  the piece next time it's opened. `ratio` is the channel's default shape (channel-configs.
 *  defaultCoverImageRatio) and, when given, wins over any shape words in the prompt text — see
 *  resolveImageSize (openai.ts). */
export async function generateCoverImage(
  prompt: string,
  ratio?: ImageRatio,
  extraInstructions?: string,
): Promise<GeneratedCoverImage> {
  return generateCoverImageOpenAi(buildCoverImagePrompt(prompt, extraInstructions), ratio)
}
