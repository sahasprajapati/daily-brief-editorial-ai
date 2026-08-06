import type { ContentBlock } from '@/lib/content-diff'

export type TiptapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  text?: string
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

export type TiptapDoc = {
  type: 'doc'
  content?: TiptapNode[]
}

export function emptyTiptapDoc(): TiptapDoc {
  return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
}

function plainText(node: TiptapNode): string {
  if (typeof node.text === 'string') return node.text
  return (node.content ?? []).map(plainText).join('')
}

/** ContentBlock[] → TipTap doc for BlockEditor (attrs.id preserves QA blockIds). */
export function contentBlocksToTiptap(blocks: ContentBlock[]): TiptapDoc {
  if (blocks.length === 0) return emptyTiptapDoc()

  return {
    type: 'doc',
    content: blocks.map((block) => {
      if (block.type === 'heading') {
        return {
          type: 'heading',
          attrs: { level: 2, id: block.blockId },
          content: block.text ? [{ type: 'text', text: block.text }] : [],
        }
      }
      return {
        type: 'paragraph',
        attrs: { id: block.blockId },
        content: block.text ? [{ type: 'text', text: block.text }] : [],
      }
    }),
  }
}

function pushBlock(
  out: ContentBlock[],
  type: ContentBlock['type'],
  text: string,
  attrs?: Record<string, unknown>,
) {
  const trimmed = text // keep internal whitespace; trim only all-empty
  if (!trimmed.trim() && type === 'paragraph') {
    // skip empty paragraphs from trailing editor noise
    return
  }
  const id =
    typeof attrs?.id === 'string' && attrs.id
      ? attrs.id
      : typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `block-${out.length}-${Date.now()}`
  out.push({ blockId: id, type, text: trimmed })
}

function flattenNode(node: TiptapNode, out: ContentBlock[]) {
  switch (node.type) {
    case 'heading':
      pushBlock(out, 'heading', plainText(node), node.attrs)
      break
    case 'paragraph':
      pushBlock(out, 'paragraph', plainText(node), node.attrs)
      break
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      for (const item of node.content ?? []) {
        flattenNode(item, out)
      }
      break
    case 'listItem':
    case 'taskItem':
      // Prefer inner paragraphs so we don't double-wrap
      if (node.content?.some((c) => c.type === 'paragraph' || c.type === 'heading')) {
        for (const child of node.content) flattenNode(child, out)
      } else {
        pushBlock(out, 'paragraph', plainText(node), node.attrs)
      }
      break
    case 'blockquote':
    case 'column':
    case 'columns':
    case 'doc':
      for (const child of node.content ?? []) flattenNode(child, out)
      break
    default:
      // Unknown / embed / hr — ignore for ContentBlock storage
      break
  }
}

/** TipTap JSON → ContentBlock[] for save + QA anchors. */
export function tiptapToContentBlocks(doc: TiptapDoc | null | undefined): ContentBlock[] {
  if (!doc || doc.type !== 'doc') return []
  const out: ContentBlock[] = []
  for (const node of doc.content ?? []) {
    flattenNode(node, out)
  }
  // Ensure at least one block so the piece remains editable
  if (out.length === 0) {
    out.push({
      blockId: crypto.randomUUID(),
      type: 'paragraph',
      text: '',
    })
  }
  return out
}
