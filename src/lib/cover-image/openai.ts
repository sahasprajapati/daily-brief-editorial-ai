import { experimental_generateImage as generateImage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { isOpenAiStub } from '@/lib/openai-stub'
import type { GeneratedCoverImage } from './types'

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
    size: '1024x1024',
  })

  const image = result.images[0]
  if (!image) {
    throw new Error('No image returned from OpenAI.')
  }
  const mimeType = image.mimeType || 'image/png'
  return { dataUrl: `data:${mimeType};base64,${image.base64}`, prompt }
}

/** No OPENAI_API_KEY — a legible placeholder SVG instead of a blank/broken image, same
 *  degrade-safely approach as every other AI integration in this app. */
function stubCoverImage(prompt: string): GeneratedCoverImage {
  const label = prompt.length > 80 ? `${prompt.slice(0, 77)}…` : prompt
  const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="#e5e7eb"/>
    <rect x="32" y="32" width="960" height="960" fill="none" stroke="#9ca3af" stroke-width="2" stroke-dasharray="12 10"/>
    <text x="512" y="480" font-family="sans-serif" font-size="28" fill="#6b7280" text-anchor="middle">Cover image placeholder</text>
    <text x="512" y="524" font-family="sans-serif" font-size="18" fill="#9ca3af" text-anchor="middle">(OPENAI_API_KEY not configured)</text>
    <foreignObject x="132" y="560" width="760" height="200">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:sans-serif;font-size:16px;color:#4b5563;text-align:center;">${escaped}</div>
    </foreignObject>
  </svg>`
  const base64 = Buffer.from(svg).toString('base64')
  return { dataUrl: `data:image/svg+xml;base64,${base64}`, prompt }
}
