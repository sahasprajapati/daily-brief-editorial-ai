import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import * as openai from './openai'
import { resolveImageSize } from './openai'
import { defaultCoverImagePrompt, generateCoverImage } from './index'

describe('resolveImageSize', () => {
  test('defaults to wide landscape — article header images are never square', () => {
    expect(resolveImageSize('Ceasefire talks resume in Cairo. Wide shot, realistic.')).toBe('1536x1024')
  })

  test('honors an explicit square instruction in the prompt', () => {
    expect(resolveImageSize('A square 1:1 icon of a dove')).toBe('1024x1024')
  })

  test('honors an explicit portrait instruction in the prompt', () => {
    expect(resolveImageSize('A tall portrait image of the skyline')).toBe('1024x1536')
  })
})

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
