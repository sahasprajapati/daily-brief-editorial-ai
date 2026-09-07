export type ImageRatio = 'landscape' | 'square' | 'portrait'
export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024'

export const RATIO_SIZE: Record<ImageRatio, ImageSize> = {
  square: '1024x1024',
  portrait: '1024x1536',
  landscape: '1536x1024',
}

export const RATIO_LABEL: Record<ImageRatio, string> = {
  landscape: 'Landscape',
  square: 'Square',
  portrait: 'Portrait',
}

/** Pure text/type module (no 'ai'/'@ai-sdk/openai' imports) so client components — the ratio
 *  picker on the Instructions settings page (ChannelAiForm) — can pull in these types and
 *  labels without dragging the OpenAI provider into the browser bundle. See openai.ts and
 *  index.ts, which both build on this file. */
