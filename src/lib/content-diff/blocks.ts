import type { ContentBlock } from './types'

/** Mints a fresh, stable blockId per paragraph - this is what makes a QA flag able to
 *  point at one exact passage instead of "the document". */
export function createBlocks(paragraphs: string[], type: ContentBlock['type'] = 'paragraph'): ContentBlock[] {
  return paragraphs.filter(Boolean).map((text) => ({ blockId: crypto.randomUUID(), type, text }))
}
