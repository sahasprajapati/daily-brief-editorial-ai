import { generateCoverImageOpenAi } from './openai'
import type { GeneratedCoverImage } from './types'

export type { GeneratedCoverImage } from './types'

const STYLE_SUFFIX =
  'Photojournalistic editorial news cover image, wide shot, realistic, no text or logos overlaid on the image.'

/** Builds a sensible default prompt from the article headline when the editor hasn't
 *  written one — still editable before generating. */
export function defaultCoverImagePrompt(headline: string): string {
  return headline ? `${headline}. ${STYLE_SUFFIX}` : STYLE_SUFFIX
}

/** Single entry point for cover image generation — today this only calls the OpenAI
 *  placeholder provider, but callers only depend on this function, so swapping in Atlas AI
 *  (or any other provider) later is a change to this file alone. */
export async function generateCoverImage(prompt: string): Promise<GeneratedCoverImage> {
  return generateCoverImageOpenAi(prompt)
}
