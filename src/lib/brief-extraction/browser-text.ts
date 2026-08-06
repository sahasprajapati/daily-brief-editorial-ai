/** Browser-side brief text extraction — only the text is submitted to the server. */

export async function extractBriefTextFromFile(file: File): Promise<{ text: string; sourceType: 'docx' | 'pdf' }> {
  const lower = file.name.toLowerCase()
  const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf')
  const isDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')

  if (!isPdf && !isDocx) {
    throw new Error('Only .docx or .pdf files are supported.')
  }

  const buffer = await file.arrayBuffer()

  if (isPdf) {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return { text: text.trim(), sourceType: 'pdf' }
  }

  const { extractBriefTextFromDocxBuffer } = await import('./docx-brief-text')
  const text = await extractBriefTextFromDocxBuffer(buffer)
  return { text, sourceType: 'docx' }
}
