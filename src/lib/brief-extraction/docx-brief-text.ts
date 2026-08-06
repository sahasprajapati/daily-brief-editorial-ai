/** Turn mammoth HTML into brief text that keeps bold section titles and row structure. */

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

/** Convert a table into numbered "Format | Topic" lines (no ## — cells are often bold). */
function tableToLines(tableHtml: string): string {
  const rows = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => {
    const cells = [...match[0].matchAll(/<t[dh][\s\S]*?<\/t[dh]>/gi)].map((cell) =>
      stripTags(cell[0]),
    )
    return cells.filter(Boolean).join(' | ')
  })
  return rows.filter(Boolean).join('\n')
}

export function htmlToBriefText(html: string): string {
  // Tables first so bold cells are not mistaken for section headers
  let text = html.replace(/<table[\s\S]*?<\/table>/gi, (table) => `\n${tableToLines(table)}\n`)

  // Bold-only paragraphs outside tables = section titles (entire <p> is one <strong>)
  text = text.replace(/<p>\s*<strong>([^<]*)<\/strong>\s*<\/p>/gi, (_m, title: string) => {
    const clean = stripTags(title)
    return clean ? `\n## ${clean}\n` : '\n'
  })

  text = text
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  text = decodeEntities(text)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text
}

export async function extractBriefTextFromDocxBuffer(
  input: Buffer | ArrayBuffer,
): Promise<string> {
  const mammoth = await import('mammoth')
  const options =
    input instanceof ArrayBuffer ? { arrayBuffer: input } : { buffer: input as Buffer }
  const result = await mammoth.convertToHtml(options)
  return htmlToBriefText(result.value)
}
