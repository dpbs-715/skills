import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, win32 } from 'node:path'

import { pathExists, repoRoot } from './utils.ts'

export interface KnowledgeIndexEntry {
  path: string
  slug: string
  summary: string
  tags: string[]
}

export interface AddKnowledgeNoteOptions {
  root?: string
  slug: string
  summary?: string
  tags?: readonly string[]
  title?: string
}

interface KnowledgeRootOptions {
  root?: string
}

const KNOWLEDGE_DIR = 'knowledge'
const NOTES_DIR = 'notes'
const INDEX_FILE = 'INDEX.md'
const NOTE_EXTENSION = '.md'
const INDEX_SEPARATOR = '\u2014'
const SUMMARY_LIMIT = 160
const DEFAULT_INDEX_PREAMBLE = '# Knowledge Index\n\n## Notes'

function normalizeIndexPath(path: string): string {
  return path.replaceAll('\\', '/')
}

function knowledgeDir(root: string): string {
  return join(root, KNOWLEDGE_DIR)
}

function notesDir(root: string): string {
  return join(knowledgeDir(root), NOTES_DIR)
}

function indexFile(root: string): string {
  return join(knowledgeDir(root), INDEX_FILE)
}

function parseSummaryAndTags(text: string): Pick<KnowledgeIndexEntry, 'summary' | 'tags'> {
  const tags: string[] = []
  let summary = text.trim()

  while (summary.length > 0) {
    const match = summary.match(/^(.*?)\s*`([^`]+)`\s*$/u)
    if (!match)
      break

    tags.unshift(match[2])
    summary = match[1].trimEnd()
  }

  return { summary: summary.trim(), tags }
}

export function parseKnowledgeIndex(markdown: string): KnowledgeIndexEntry[] {
  const entries: KnowledgeIndexEntry[] = []

  for (const line of markdown.split(/\r?\n/u)) {
    const match = line.match(/^- \[([^\]]+)\]\(([^)]+)\)(?:\s+\u2014\s*(.*))?$/u)
    if (!match)
      continue

    const details = parseSummaryAndTags(match[3] ?? '')
    entries.push({
      path: normalizeIndexPath(match[2]),
      slug: match[1],
      summary: details.summary,
      tags: details.tags,
    })
  }

  return entries
}

export async function listKnowledgeNotes({
  root = repoRoot(),
}: KnowledgeRootOptions = {}): Promise<KnowledgeIndexEntry[]> {
  if (!await pathExists(indexFile(root)))
    return []

  return parseKnowledgeIndex(await readFile(indexFile(root), 'utf-8'))
}

function formatKnowledgeIndexEntry(entry: KnowledgeIndexEntry): string {
  const tags = entry.tags.map(tag => `\`${tag}\``)
  const details = [entry.summary, ...tags].filter(Boolean).join(' ')
  const suffix = details ? ` ${INDEX_SEPARATOR} ${details}` : ''

  return `- [${entry.slug}](${entry.path})${suffix}`
}

function indexPreamble(markdown: string): string {
  const lines = markdown.split(/\r?\n/u)
  const notesHeading = lines.findIndex(line => line.trim() === '## Notes')

  if (notesHeading === -1)
    return DEFAULT_INDEX_PREAMBLE

  return lines.slice(0, notesHeading + 1).join('\n').trimEnd()
}

async function readIndexPreamble(root: string): Promise<string> {
  if (!await pathExists(indexFile(root)))
    return DEFAULT_INDEX_PREAMBLE

  return indexPreamble(await readFile(indexFile(root), 'utf-8'))
}

function sortEntries(entries: KnowledgeIndexEntry[]): KnowledgeIndexEntry[] {
  return [...entries].sort((left, right) => left.path.localeCompare(right.path))
}

async function writeKnowledgeIndex(root: string, entries: KnowledgeIndexEntry[]): Promise<void> {
  const preamble = await readIndexPreamble(root)
  const body = sortEntries(entries).map(formatKnowledgeIndexEntry).join('\n')
  const content = body ? `${preamble}\n\n${body}\n` : `${preamble}\n\n`

  await mkdir(knowledgeDir(root), { recursive: true })
  await writeFile(indexFile(root), content)
}

function slugFromIndexPath(path: string): string {
  const normalized = normalizeIndexPath(path)
  const prefix = `${NOTES_DIR}/`

  if (normalized.startsWith(prefix) && normalized.endsWith(NOTE_EXTENSION))
    return normalized.slice(prefix.length, -NOTE_EXTENSION.length)

  return normalized
}

function indexPathForNote(root: string, path: string): string {
  return normalizeIndexPath(relative(knowledgeDir(root), path))
}

async function listNoteFiles(dir: string): Promise<string[]> {
  if (!await pathExists(dir))
    return []

  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.startsWith('.'))
      continue

    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listNoteFiles(path))
      continue
    }

    if (entry.isFile() && entry.name.endsWith(NOTE_EXTENSION))
      files.push(path)
  }

  return files
}

function firstParagraphSummary(markdown: string): string {
  const paragraph: string[] = []

  for (const [index, line] of markdown.split(/\r?\n/u).entries()) {
    const trimmed = line.trim()
    if (index === 0 && /^#\s+/u.test(trimmed))
      continue

    if (trimmed.length === 0) {
      if (paragraph.length > 0)
        break
      continue
    }

    if (/^#{1,6}\s+/u.test(trimmed)) {
      if (paragraph.length > 0)
        break
      continue
    }

    if (trimmed.startsWith('```')) {
      if (paragraph.length > 0)
        break
      continue
    }

    paragraph.push(trimmed)
  }

  const summary = paragraph.join(' ').replaceAll(/\s+/gu, ' ').trim()
  if (summary.length <= SUMMARY_LIMIT)
    return summary

  return `${summary.slice(0, SUMMARY_LIMIT - 3).trimEnd()}...`
}

async function noteSummary(path: string): Promise<string> {
  return firstParagraphSummary(await readFile(path, 'utf-8'))
}

export async function reindexKnowledge({
  root = repoRoot(),
}: KnowledgeRootOptions = {}): Promise<KnowledgeIndexEntry[]> {
  const existingEntries = await listKnowledgeNotes({ root })
  const existingByPath = new Map(existingEntries.map(entry => [entry.path, entry]))
  const entries: KnowledgeIndexEntry[] = []

  for (const file of await listNoteFiles(notesDir(root))) {
    const path = indexPathForNote(root, file)
    const existing = existingByPath.get(path)
    entries.push({
      path,
      slug: slugFromIndexPath(path),
      summary: existing?.summary ?? await noteSummary(file),
      tags: existing?.tags ?? [],
    })
  }

  await writeKnowledgeIndex(root, entries)
  return sortEntries(entries)
}

function assertSafeSlug(slug: string): string {
  const normalized = normalizeIndexPath(slug)
  const segments = normalized.split('/')

  if (
    normalized.length === 0
    || normalized.endsWith('/')
    || isAbsolute(normalized)
    || win32.isAbsolute(slug)
    || segments.some(segment => segment.length === 0 || segment === '.' || segment === '..' || segment.startsWith('.'))
  ) {
    throw new Error(`Invalid note slug: ${slug}`)
  }

  return normalized
}

function titleFromSlug(slug: string): string {
  const lastSegment = slug.split('/').at(-1) ?? slug
  return lastSegment
    .split(/[-_]+/u)
    .filter(Boolean)
    .map(word => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

function noteMarkdown(title: string, summary: string): string {
  const body = summary.trim()
  return body ? `# ${title}\n\n${body}\n` : `# ${title}\n`
}

export async function addKnowledgeNote({
  root = repoRoot(),
  slug,
  summary = '',
  tags = [],
  title = titleFromSlug(assertSafeSlug(slug)),
}: AddKnowledgeNoteOptions): Promise<KnowledgeIndexEntry> {
  const safeSlug = assertSafeSlug(slug)
  const rootNotesDir = notesDir(root)
  const notePath = resolve(rootNotesDir, `${safeSlug}${NOTE_EXTENSION}`)
  const relativeNotePath = relative(rootNotesDir, notePath)

  if (relativeNotePath.startsWith('..') || isAbsolute(relativeNotePath))
    throw new Error(`Invalid note slug: ${slug}`)

  const path = `${NOTES_DIR}/${safeSlug}${NOTE_EXTENSION}`

  if (await pathExists(notePath))
    throw new Error(`Note already exists: ${path}`)

  await mkdir(dirname(notePath), { recursive: true })
  await writeFile(notePath, noteMarkdown(title, summary), { flag: 'wx' })

  const entry: KnowledgeIndexEntry = {
    path,
    slug: safeSlug,
    summary,
    tags: [...tags],
  }
  const existingEntries = (await listKnowledgeNotes({ root })).filter(existing => existing.path !== entry.path)
  await writeKnowledgeIndex(root, [...existingEntries, entry])

  return entry
}
