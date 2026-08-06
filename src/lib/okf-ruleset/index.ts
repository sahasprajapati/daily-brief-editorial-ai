import { readFile } from 'fs/promises'
import path from 'path'

const OKF_ROOT = path.join(process.cwd(), 'okf-ruleset')

/** Strips the leading YAML frontmatter block (between the first two `---` lines) - the
 *  generation prompt only needs the guideline's prose, not its structured metadata. */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?/)
  return match ? content.slice(match[0].length).trim() : content.trim()
}

export async function getGuidelineText(slug: string | null | undefined): Promise<string | null> {
  if (!slug) return null
  try {
    const content = await readFile(path.join(OKF_ROOT, 'guidelines', `${slug}.md`), 'utf-8')
    return stripFrontmatter(content)
  } catch {
    return null
  }
}
