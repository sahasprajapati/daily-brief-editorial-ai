import { describe, expect, test } from 'bun:test'
import { getGuidelineText } from './index'

describe('getGuidelineText', () => {
  test('returns null for a null/undefined/empty slug', async () => {
    expect(await getGuidelineText(null)).toBeNull()
    expect(await getGuidelineText(undefined)).toBeNull()
    expect(await getGuidelineText('')).toBeNull()
  })

  test('returns null when the guideline file does not exist', async () => {
    expect(await getGuidelineText('no-such-guideline')).toBeNull()
  })

  test('strips frontmatter and returns the body for a real guideline', async () => {
    const text = await getGuidelineText('gaza-ceasefire-example')
    expect(text).not.toBeNull()
    expect(text).not.toContain('---')
    expect(text).toContain('# Gaza ceasefire coverage')
    expect(text).toContain('Depends on:')
  })
})
