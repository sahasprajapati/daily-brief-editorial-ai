export interface LexicalTextNode {
  type: 'text'
  text: string
  format: number
  detail: number
  mode: 'normal'
  style: string
  version: 1
}

export interface LexicalParagraphNode {
  type: 'paragraph'
  format: ''
  indent: 0
  version: 1
  direction: 'ltr'
  children: LexicalTextNode[]
}

export interface LexicalEditorState {
  root: {
    type: 'root'
    format: ''
    indent: 0
    version: 1
    direction: 'ltr'
    children: LexicalParagraphNode[]
  }
}

function textNode(text: string): LexicalTextNode {
  return { type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }
}

function paragraphNode(text: string): LexicalParagraphNode {
  return { type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', children: [textNode(text)] }
}

/** trt-global-cms-prod's `contents.body` field is Lexical rich text (`editor: lexicalEditor()`
 *  in its payload.config.ts), so plain generated/edited paragraphs must be wrapped in Lexical's
 *  serialized editor-state shape before POSTing to /api/packages/create. */
export function plainTextToLexicalJSON(paragraphs: string[]): LexicalEditorState {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: paragraphs.filter(Boolean).map(paragraphNode),
    },
  }
}
