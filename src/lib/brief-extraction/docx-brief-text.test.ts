import { describe, expect, test } from 'bun:test'
import { htmlToBriefText } from './docx-brief-text'

describe('htmlToBriefText', () => {
  test('preserves bold section titles and table rows', () => {
    const html = [
      '<p><strong>TRT RUSSIAN  </strong>DAILY BRIEF</p>',
      '<p>28 July 2026  ·  Digital Team</p>',
      '<p><strong>INTERNATIONAL NEWS</strong></p>',
      '<table><tr><td><p><strong>1.</strong></p></td><td><p><strong>News</strong></p></td>',
      '<td><p><strong>Azerbaijan to Host First-Ever U-15 Football World Cup</strong></p></td></tr></table>',
      '<p><strong>GAZA &amp; PALESTINE</strong></p>',
      '<table><tr><td><p><strong>1.</strong></p></td><td><p><strong>Video</strong></p></td>',
      '<td><p><strong>Israel Releases 60 Palestinian Detainees Under Ceasefire Deal</strong></p></td></tr></table>',
    ].join('')

    const text = htmlToBriefText(html)

    expect(text).toContain('## INTERNATIONAL NEWS')
    expect(text).toContain('## GAZA & PALESTINE')
    expect(text).toMatch(/1\.\s*\|\s*News\s*\|\s*Azerbaijan to Host First-Ever U-15 Football World Cup/)
    expect(text).toMatch(/1\.\s*\|\s*Video\s*\|\s*Israel Releases 60 Palestinian Detainees Under Ceasefire Deal/)
    // Table cells must not become ## headers
    expect(text).not.toMatch(/## News/)
    expect(text).not.toMatch(/## Video/)
    expect(text).not.toMatch(/## 1\./)
  })
})
