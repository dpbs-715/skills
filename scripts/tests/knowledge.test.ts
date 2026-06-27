import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import { run as runNote } from '../commands/note.ts'
import { addKnowledgeNote, listKnowledgeNotes, reindexKnowledge } from '../lib/knowledge.ts'

const temporaryPaths: string[] = []
const INDEX_SEPARATOR = '\u2014'

async function createTempDir(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix))
  temporaryPaths.push(path)
  return path
}

async function writeKnowledgeIndex(root: string, body: string): Promise<void> {
  await mkdir(join(root, 'knowledge'), { recursive: true })
  await writeFile(join(root, 'knowledge', 'INDEX.md'), body)
}

async function writeNote(root: string, path: string, body: string): Promise<void> {
  const notePath = join(root, 'knowledge', 'notes', path)
  await mkdir(dirname(notePath), { recursive: true })
  await writeFile(notePath, body)
}

test('list parses entries from knowledge index', async () => {
  const root = await createTempDir('skills-knowledge-')
  await writeKnowledgeIndex(root, `# Knowledge Index

## Notes

- [foo](notes/foo.md) ${INDEX_SEPARATOR} Foo summary \`alpha\` \`beta\`
- [command-notes/bar](notes/command-notes/bar.md) ${INDEX_SEPARATOR} Bar summary
`)

  const entries = await listKnowledgeNotes({ root })

  assert.deepEqual(entries, [
    {
      path: 'notes/foo.md',
      slug: 'foo',
      summary: 'Foo summary',
      tags: ['alpha', 'beta'],
    },
    {
      path: 'notes/command-notes/bar.md',
      slug: 'command-notes/bar',
      summary: 'Bar summary',
      tags: [],
    },
  ])
})

test('reindex preserves existing summary and tags by path', async () => {
  const root = await createTempDir('skills-knowledge-')
  await writeKnowledgeIndex(root, `# Knowledge Index

## Notes

- [foo](notes/foo.md) ${INDEX_SEPARATOR} Existing summary \`keep\` \`tags\`
`)
  await writeNote(root, 'foo.md', `# Foo

Generated summary should not replace existing index text.
`)
  await writeNote(root, 'bar.md', `# Bar

## One Line

Generated summary for bar.
`)
  await writeNote(root, '.obsidian/internal.md', `# Internal

Hidden note.
`)
  await writeNote(root, '.private/hidden.md', `# Hidden

Hidden note.
`)

  const entries = await reindexKnowledge({ root })

  assert.deepEqual(entries, [
    {
      path: 'notes/bar.md',
      slug: 'bar',
      summary: 'Generated summary for bar.',
      tags: [],
    },
    {
      path: 'notes/foo.md',
      slug: 'foo',
      summary: 'Existing summary',
      tags: ['keep', 'tags'],
    },
  ])

  const index = await readFile(join(root, 'knowledge', 'INDEX.md'), 'utf-8')
  assert.match(index, /notes\/bar\.md/)
  assert.match(index, /Existing summary `keep` `tags`/)
  assert.doesNotMatch(index, /Hidden note/)
})

test('add creates a note file and updates the index', async () => {
  const root = await createTempDir('skills-knowledge-')
  await writeKnowledgeIndex(root, `# Knowledge Index

## Notes

`)

  const entry = await addKnowledgeNote({
    root,
    slug: 'command-notes/foo',
    summary: 'Foo summary.',
    tags: ['commands', 'notes'],
    title: 'Foo Title',
  })

  assert.deepEqual(entry, {
    path: 'notes/command-notes/foo.md',
    slug: 'command-notes/foo',
    summary: 'Foo summary.',
    tags: ['commands', 'notes'],
  })
  assert.equal(
    await readFile(join(root, 'knowledge', 'notes', 'command-notes', 'foo.md'), 'utf-8'),
    '# Foo Title\n\nFoo summary.\n',
  )
  assert.match(
    await readFile(join(root, 'knowledge', 'INDEX.md'), 'utf-8'),
    /\[command-notes\/foo]\(notes\/command-notes\/foo\.md\).*Foo summary\. `commands` `notes`/,
  )
})

test('add rejects path traversal slugs', async () => {
  const root = await createTempDir('skills-knowledge-')

  await assert.rejects(
    () => addKnowledgeNote({ root, slug: '../outside' }),
    /Invalid note slug/,
  )
})

test('add rejects existing note files', async () => {
  const root = await createTempDir('skills-knowledge-')

  await addKnowledgeNote({ root, slug: 'foo', title: 'Foo' })

  await assert.rejects(
    () => addKnowledgeNote({ root, slug: 'foo', title: 'Foo Again' }),
    /Note already exists: notes\/foo\.md/,
  )
})

test('note command rejects unknown arguments', async () => {
  await assert.rejects(
    () => runNote(['list', '--unexpected']),
    /Unknown argument for note list: --unexpected/,
  )

  await assert.rejects(
    () => runNote(['add', 'foo', '--unexpected']),
    /Unknown argument for note add: --unexpected/,
  )
})

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
