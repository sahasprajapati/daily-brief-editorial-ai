export interface ContentBlock {
  blockId: string
  type: 'paragraph' | 'heading'
  text: string
}

export type BlockDiffStatus = 'unchanged' | 'changed' | 'added' | 'removed'

export interface BlockDiffEntry {
  blockId: string
  status: BlockDiffStatus
  type: ContentBlock['type']
  text: string
  /** HTML with <ins>/<del> markup from htmldiff-js. Only set when status is 'changed'. */
  diffHtml?: string
}
