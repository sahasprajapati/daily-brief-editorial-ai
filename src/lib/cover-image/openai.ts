import { experimental_generateImage as generateImage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { isOpenAiStub } from '@/lib/openai-stub'
import type { GeneratedCoverImage } from './types'

type ImageSize = '1024x1024' | '1024x1536' | '1536x1024'

/** Cover images run as a website article header/hero banner, so they default to wide landscape
 *  - never square. An editor who has actually typed a different shape into the prompt (square,
 *  portrait, …) means it, so that explicit instruction wins instead of being silently forced
 *  back to landscape. */
export function resolveImageSize(prompt: string): ImageSize {
  const p = prompt.toLowerCase()
  if (/\bsquare\b|\b1:1\b/.test(p)) return '1024x1024'
  if (/\bportrait\b|\bvertical\b|\b9:16\b|\b2:3\b/.test(p)) return '1024x1536'
  return '1536x1024'
}

/** Placeholder provider — OpenAI's gpt-image-1, swapped for a proper asset pipeline / Atlas AI
 *  later (see generated-pieces.coverImageDataUrl doc comment). dall-e-3 isn't available on
 *  every account; gpt-image-1 is the current image model that reliably is. */
export async function generateCoverImageOpenAi(prompt: string): Promise<GeneratedCoverImage> {
  if (isOpenAiStub()) {
    return stubCoverImage(prompt)
  }

  const result = await generateImage({
    model: openai.image('gpt-image-1'),
    prompt,
    size: resolveImageSize(prompt),
  })

  const image = result.images[0]
  if (!image) {
    throw new Error('No image returned from OpenAI.')
  }
  const mimeType = image.mimeType || 'image/png'
  return { dataUrl: `data:${mimeType};base64,${image.base64}`, prompt }
}

/** No OPENAI_API_KEY — a legible placeholder SVG instead of a blank/broken image, same
 *  degrade-safely approach as every other AI integration in this app. Sized to match whatever
 *  the real call would have requested, so the stub doesn't mislead editors into thinking cover
 *  images render square. */
function stubCoverImage(prompt: string): GeneratedCoverImage {
  const [w, h] = resolveImageSize(prompt).split('x').map(Number)
  const label = prompt.length > 80 ? `${prompt.slice(0, 77)}…` : prompt
  const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const midY = Math.round(h / 2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#e5e7eb"/>
    <rect x="32" y="32" width="${w - 64}" height="${h - 64}" fill="none" stroke="#9ca3af" stroke-width="2" stroke-dasharray="12 10"/>
    <text x="${w / 2}" y="${midY - 32}" font-family="sans-serif" font-size="28" fill="#6b7280" text-anchor="middle">Cover image placeholder</text>
    <text x="${w / 2}" y="${midY + 12}" font-family="sans-serif" font-size="18" fill="#9ca3af" text-anchor="middle">(OPENAI_API_KEY not configured)</text>
    <foreignObject x="${w * 0.13}" y="${midY + 48}" width="${w * 0.74}" height="200">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:sans-serif;font-size:16px;color:#4b5563;text-align:center;">${escaped}</div>
    </foreignObject>
  </svg>`
  const base64 = Buffer.from(svg).toString('base64')
  return { dataUrl: `data:image/svg+xml;base64,${base64}`, prompt }
}
