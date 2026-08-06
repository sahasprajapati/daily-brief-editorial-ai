import { extractText, getDocumentProxy } from 'unpdf'
import { extractBriefTextFromDocxBuffer } from './docx-brief-text'

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  return extractBriefTextFromDocxBuffer(buffer)
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  return text.trim()
}
