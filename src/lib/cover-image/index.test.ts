import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import * as openai from './openai'
import { resolveImageSize } from './openai'
import { buildCoverImagePrompt, defaultCoverImagePrompt, generateCoverImage, IMAGE_STYLE_INSTRUCTIONS } from './index'

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

  // Regression: the base style directive used to say "never square or portrait unless
  // explicitly requested" — resolveImageSize scans the whole prompt for those exact words as
  // an override signal, so that wording tripped its own override on every generation and every
  // cover image came out square. The directive must never contain these trigger words itself.
  test('the base style directive does not contain its own override trigger words', () => {
    expect(resolveImageSize(IMAGE_STYLE_INSTRUCTIONS)).toBe('1536x1024')
  })
})

afterEach(() => {
  ;(openai.generateCoverImageOpenAi as any).mockRestore?.()
})

describe('buildCoverImagePrompt', () => {
  test('appends the base style directive to the subject line', () => {
    const built = buildCoverImagePrompt('Ceasefire talks resume in Cairo')
    expect(built).toContain('Ceasefire talks resume in Cairo')
    expect(built).toContain(IMAGE_STYLE_INSTRUCTIONS)
  })

  test('is idempotent — regenerating from an already-combined prompt does not duplicate it', () => {
    const once = buildCoverImagePrompt('Ceasefire talks resume in Cairo')
    const twice = buildCoverImagePrompt(once)
    expect(twice).toBe(once)
  })

  test('falls back to just the style directive with no subject', () => {
    expect(buildCoverImagePrompt('')).toBe(IMAGE_STYLE_INSTRUCTIONS)
  })
})

describe('defaultCoverImagePrompt', () => {
  test('builds a prompt from the headline, including the style directive', () => {
    const prompt = defaultCoverImagePrompt('Ceasefire talks resume in Cairo')
    expect(prompt).toContain('Ceasefire talks resume in Cairo')
    expect(prompt).toContain(IMAGE_STYLE_INSTRUCTIONS)
  })

  test('falls back to the style directive when there is no headline', () => {
    expect(defaultCoverImagePrompt('')).toBe(IMAGE_STYLE_INSTRUCTIONS)
  })
})

describe('generateCoverImage', () => {
  test('always layers the style directive onto the caller-supplied prompt before calling OpenAI', async () => {
    const spy = spyOn(openai, 'generateCoverImageOpenAi').mockResolvedValue({
      dataUrl: 'data:image/png;base64,abc',
      prompt: 'combined prompt',
    })

    await generateCoverImage('Ceasefire talks resume in Cairo')

    expect(spy).toHaveBeenCalledWith(buildCoverImagePrompt('Ceasefire talks resume in Cairo'))
  })

  test('does not duplicate the style directive when regenerating from an already-combined prompt', async () => {
    const spy = spyOn(openai, 'generateCoverImageOpenAi').mockResolvedValue({
      dataUrl: 'data:image/png;base64,abc',
      prompt: 'combined prompt',
    })
    const stored = defaultCoverImagePrompt('Ceasefire talks resume in Cairo')

    await generateCoverImage(stored)

    expect(spy).toHaveBeenCalledWith(stored)
  })
})
