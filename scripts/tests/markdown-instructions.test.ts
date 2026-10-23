import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { linkTargets } from '../../meta.ts'
import { linkAll, unlinkAll } from '../commands/link.ts'
import { ensureMarkdownSection, removeMarkdownSections } from '../lib/markdownInstructions.ts'
import type { MarkdownSectionTarget } from '../lib/metaTypes.ts'

const temporaryPaths: string[] = []

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'markdown-instructions-'))
  temporaryPaths.push(root)
  const host = join(root, 'host')
  await mkdir(host)
  await writeFile(join(root, 'source.md'), '---\nname: discovery\ndescription: test\n---\n\n# Discovery\n\nRead maps here.\n')
  const target: MarkdownSectionTarget = {
    file: join(host, 'AGENTS.md'), kind: 'markdown-section', section: 'project-workspaces', source: 'source.md',
    preferExisting: ['AGENTS.override.md'],
  }
  return { root, host, target }
}

test('managed sections preserve existing instructions, update once and unlink cleanly', async () => {
  const { root, target } = await fixture()
  const original = '# My instructions\nUse Chinese.\n'
  await writeFile(target.file, original)
  assert.equal((await ensureMarkdownSection(target, root)).status, 'updated')
  const linked = await readFile(target.file, 'utf8')
  assert.ok(linked.startsWith(original))
  assert.doesNotMatch(linked, /name: discovery/)
  assert.equal((await ensureMarkdownSection(target, root)).status, 'exists')
  await writeFile(join(root, 'source.md'), '# Discovery v2\n')
  await ensureMarkdownSection(target, root)
  const updated = await readFile(target.file, 'utf8')
  assert.equal(updated.match(/skills-managed:project-workspaces:start/g)?.length, 1)
  assert.match(updated, /Discovery v2/)
  await removeMarkdownSections(target)
  assert.equal(await readFile(target.file, 'utf8'), original)
})

test('global override files receive the section and existing symlinks are preserved', async () => {
  const { root, host, target } = await fixture()
  const actual = join(host, 'actual.md')
  const override = join(host, 'AGENTS.override.md')
  await writeFile(actual, 'Override preferences without trailing newline')
  await symlink(actual, override)
  await writeFile(target.file, 'Base preferences\n')
  await ensureMarkdownSection(target, root)
  assert.equal(await readlink(override), actual)
  assert.match(await readFile(actual, 'utf8'), /Read maps here/)
  assert.equal(await readFile(target.file, 'utf8'), 'Base preferences\n')
  await removeMarkdownSections(target)
  assert.equal(await readFile(actual, 'utf8'), 'Override preferences without trailing newline')
})

test('malformed managed markers fail without overwriting user content', async () => {
  const { root, target } = await fixture()
  const original = '<!-- skills-managed:project-workspaces:start -->\nUser content\n'
  await writeFile(target.file, original)
  await assert.rejects(ensureMarkdownSection(target, root), /Malformed/)
  await assert.rejects(removeMarkdownSections(target), /Malformed/)
  assert.equal(await readFile(target.file, 'utf8'), original)
})

test('linkAll and unlinkAll handle global sections and leave missing host directories alone', async () => {
  const { root, target } = await fixture()
  const missing = { ...target, file: join(root, 'not-installed', 'AGENTS.md') }
  const options = { root, localSkillSources: [], targets: [target, missing] }
  const result = await linkAll(options)
  assert.equal(result.length, 1)
  assert.equal(result[0].status, 'linked')
  assert.equal((await linkAll(options))[0].status, 'exists')
  await unlinkAll(options)
  assert.equal(await readFile(target.file, 'utf8'), '')
})

test('default targets bootstrap discovery and routing for Codex/Pi and rule-based hosts', () => {
  for (const file of ['~/.codex/AGENTS.md', '~/.pi/agent/AGENTS.md']) {
    for (const section of ['agent-routing', 'project-workspaces']) {
      assert.ok(linkTargets.some(target => target.kind === 'markdown-section'
        && target.file === file && target.section === section))
    }
  }
  for (const dir of ['~/.claude/rules', '~/.config/opencode/rules']) {
    const target = linkTargets.find(target => target.kind === 'rule' && target.dir === dir)
    assert.ok(target && target.kind === 'rule')
    assert.ok(target.include.includes('agent-routing'))
    assert.ok(target.include.includes('project-workspaces'))
  }
})

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
