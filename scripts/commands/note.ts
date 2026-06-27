import {
  addKnowledgeNote,
  listKnowledgeNotes,
  reindexKnowledge,
  type KnowledgeIndexEntry,
} from '../lib/knowledge.ts'

interface AddArgs {
  slug: string
  summary?: string
  tags: string[]
  title?: string
}

function requireNoArgs(subcommand: string, args: string[]): void {
  if (args.length > 0)
    throw new Error(`Unknown argument for note ${subcommand}: ${args[0]}`)
}

function readValue(args: string[], index: number, option: string): string {
  const value = args[index + 1]
  if (!value)
    throw new Error(`${option} requires a value`)

  return value
}

function parseAddArgs(args: string[]): AddArgs {
  const slug = args[0]
  if (!slug || slug.startsWith('-'))
    throw new Error('note add requires a slug')

  const parsed: AddArgs = { slug, tags: [] }

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--title') {
      parsed.title = readValue(args, index, arg)
      index += 1
      continue
    }

    if (arg === '--summary') {
      parsed.summary = readValue(args, index, arg)
      index += 1
      continue
    }

    if (arg === '--tag') {
      parsed.tags.push(readValue(args, index, arg))
      index += 1
      continue
    }

    throw new Error(`Unknown argument for note add: ${arg}`)
  }

  return parsed
}

function printEntries(entries: KnowledgeIndexEntry[]): void {
  if (entries.length === 0) {
    console.log('No knowledge notes indexed.')
    return
  }

  for (const entry of entries) {
    const tags = entry.tags.map(tag => `\`${tag}\``).join(' ')
    const details = [entry.summary, tags].filter(Boolean).join(' ')
    const suffix = details ? ` - ${details}` : ''
    console.log(`${entry.slug} (${entry.path})${suffix}`)
  }
}

export async function run(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args

  if (!subcommand)
    throw new Error('note requires a subcommand: list, reindex, or add')

  if (subcommand === 'list') {
    requireNoArgs(subcommand, rest)
    printEntries(await listKnowledgeNotes())
    return
  }

  if (subcommand === 'reindex') {
    requireNoArgs(subcommand, rest)
    const entries = await reindexKnowledge()
    console.log(`Indexed ${entries.length} note(s).`)
    return
  }

  if (subcommand === 'add') {
    const entry = await addKnowledgeNote(parseAddArgs(rest))
    console.log(`Added: ${entry.path}`)
    return
  }

  throw new Error(`Unknown note subcommand: ${subcommand}`)
}
