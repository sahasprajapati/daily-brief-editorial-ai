import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import * as openai from './openai'
import { defaultCoverImagePrompt, generateCoverImage } from './index'

afterEach(() => {
  ;(openai.generateCoverImageOpenAi as any).mockRestore?.()
})

describe('defaultCoverImagePrompt', () => {
  test('builds a prompt from the headline', () => {
    expect(defaultCoverImagePrompt('Ceasefire talks resume in Cairo')).toContain(
      'Ceasefire talks resume in Cairo',
    )
  })

  test('falls back to a generic style prompt when there is no headline', () => {
    expect(defaultCoverImagePrompt('')).not.toBe('')
  })
})

describe('generateCoverImage', () => {
  test('delegates to the OpenAI provider', async () => {
    spyOn(openai, 'generateCoverImageOpenAi').mockResolvedValue({
      dataUrl: 'data:image/png;base64,abc',
      prompt: 'a prompt',
    })

    const result = await generateCoverImage('a prompt')

    expect(result).toEqual({ dataUrl: 'data:image/png;base64,abc', prompt: 'a prompt' })
  })
})
