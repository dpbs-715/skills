import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import type { MarkdownSectionTarget } from './metaTypes.ts'
import type { LinkResult } from './symlink.ts'
import { pathExists } from './utils.ts'

function markers(section: string): { start: string, end: string } {
  if (!/^[a-z][a-z0-9-]*$/.test(section))
    throw new Error(`Invalid managed instruction section: ${section}`)
  return {
    start: `<!-- skills-managed:${section}:start -->`,
    end: `<!-- skills-managed:${section}:end -->`,
  }
}

function sectionRange(content: string, section: string): [number, number] | undefined {
  const { start, end } = markers(section)
  const startIndex = content.indexOf(start)
  const endIndex = content.indexOf(end)
  if (startIndex === -1 && endIndex === -1)
    return undefined
  if (startIndex === -1 || endIndex < startIndex
    || content.indexOf(start, startIndex + start.length) !== -1
    || content.indexOf(end, endIndex + end.length) !== -1)
    throw new Error(`Malformed managed instruction section: ${section}`)

  return [startIndex, endIndex + end.length]
}

export async function instructionFile(target: MarkdownSectionTarget): Promise<string> {
  for (const name of target.preferExisting ?? []) {
    const candidate = join(dirname(target.file), name)
    if (await pathExists(candidate) && (await readFile(candidate, 'utf8')).trim())
      return candidate
  }
  return target.file
}

export async function ensureMarkdownSection(target: MarkdownSectionTarget, root: string): Promise<LinkResult> {
  const file = await instructionFile(target)
  const existed = await pathExists(file)
  const original = existed ? await readFile(file, 'utf8') : ''
  const source = (await readFile(join(root, target.source), 'utf8'))
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .trim()
  const { start, end } = markers(target.section)
  const block = `${start}\n${source}\n${end}`
  const range = sectionRange(original, target.section)
  const next = range
    ? original.slice(0, range[0]) + block + original.slice(range[1])
    : original + (original ? '\n\n' : '') + block + '\n'
  if (next !== original)
    await writeFile(file, next)

  return {
    name: basename(file),
    target: dirname(file),
    status: next === original ? 'exists' : existed ? 'updated' : 'linked',
  }
}

export async function removeMarkdownSections(target: MarkdownSectionTarget): Promise<LinkResult[]> {
  const files = new Set([target.file, ...(target.preferExisting ?? []).map(name => join(dirname(target.file), name))])
  const results: LinkResult[] = []
  for (const file of files) {
    if (!await pathExists(file))
      continue
    const content = await readFile(file, 'utf8')
    const range = sectionRange(content, target.section)
    if (!range)
      continue
    let [start, end] = range
    // Remove the separator added on append, preserving the original bytes.
    if (content.slice(start - 2, start) === '\n\n')
      start -= 2
    if (content[end] === '\n')
      end += 1
    await writeFile(file, content.slice(0, start) + content.slice(end))
    results.push({ name: basename(file), target: dirname(file), status: 'removed' })
  }
  return results
}
