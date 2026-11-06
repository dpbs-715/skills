import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { linkTargets, localSkillSources } from '../../meta.template.ts'
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

test('short entry sources expand checkout paths without embedding the full skill', async () => {
  const { root, target } = await fixture()
  await mkdir(join(root, 'generated', 'project-workspaces'), { recursive: true })
  const skill = join(root, 'generated', 'project-workspaces', 'SKILL.md')
  await writeFile(skill, '# Full discovery workflow\nDetailed instructions stay here.\n')
  await writeFile(join(root, 'source.md'), '# Discovery\nRead `{{REPO_ROOT}}/generated/project-workspaces/SKILL.md`.\n')

  await ensureMarkdownSection(target, root)
  const content = await readFile(target.file, 'utf8')
  assert.ok(content.includes(skill))
  assert.doesNotMatch(content, /\{\{REPO_ROOT\}\}|Detailed instructions/)
  assert.equal((await ensureMarkdownSection(target, root)).status, 'exists')
})

test('linking short context entries removes duplicate owned skill links and retains full bundles', async () => {
  const { root, host, target } = await fixture()
  const dir = join(host, 'skills')
  await mkdir(dir)
  for (const name of ['agent-routing', 'project-workspaces', 'mock']) {
    const source = join(root, 'generated', name)
    await mkdir(source, { recursive: true })
    await writeFile(join(source, 'SKILL.md'), `# ${name}\n`)
    await symlink(source, join(dir, name))
  }
  await symlink('/tmp/foreign-skill', join(dir, 'foreign'))
  const options = {
    root, localSkillSources: [],
    targets: [target, { dir, kind: 'skill' as const, include: ['mock'] }],
  }
  await linkAll(options)
  for (const name of ['agent-routing', 'project-workspaces']) {
    await assert.rejects(readlink(join(dir, name)), /ENOENT/)
    assert.equal(await readFile(join(root, 'generated', name, 'SKILL.md'), 'utf8'), `# ${name}\n`)
  }
  assert.equal(await readlink(join(dir, 'mock')), join(root, 'generated', 'mock'))
  assert.equal(await readlink(join(dir, 'foreign')), '/tmp/foreign-skill')
  assert.ok((await linkAll(options)).every(result => result.status === 'exists'))
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
        && target.file === file && target.section === section
        && target.source === `rules/${section}/ENTRY.md`))
    }
  }
  for (const dir of ['~/.claude/rules', '~/.config/opencode/rules']) {
    const target = linkTargets.find(target => target.kind === 'rule' && target.dir === dir)
    assert.ok(target && target.kind === 'rule')
    assert.ok(target.include.includes('agent-routing'))
    assert.ok(target.include.includes('project-workspaces'))
  }
  for (const dir of ['~/.codex/skills', '~/.pi/agent/skills', '~/.agents/skills']) {
    const target = linkTargets.find(target => target.kind === 'skill' && target.dir === dir)
    assert.ok(target && target.kind === 'skill')
    assert.ok(!target.include.includes('agent-routing'))
    assert.ok(!target.include.includes('project-workspaces'))
    assert.ok(target.include.includes('mock'))
  }
  const kimi = linkTargets.find(target => target.kind === 'skill' && target.dir === '~/.kimi-code/skills')
  assert.ok(kimi && kimi.kind === 'skill')
  assert.ok(kimi.include.includes('agent-routing'))
  assert.ok(kimi.include.includes('project-workspaces'))
})

test('communication rules load as context instead of optional skills on supported hosts', async () => {
  const source = localSkillSources.find(source => source.name === 'communication-rules')
  assert.ok(source && source.kind === 'document')
  for (const file of ['~/.codex/AGENTS.md', '~/.pi/agent/AGENTS.md']) {
    const target = linkTargets.find(target => target.kind === 'markdown-section' && target.file === file && target.section === 'communication-rules')
    assert.ok(target && target.kind === 'markdown-section')
    assert.equal(target.source, source.source)
  }
  for (const dir of ['~/.codex/skills', '~/.pi/agent/skills', '~/.agents/skills', '~/.claude/skills', '~/.config/opencode/skills']) {
    const target = linkTargets.find(target => target.kind === 'skill' && target.dir === dir)
    assert.ok(target && target.kind === 'skill')
    assert.ok(!target.include.includes('communication-rules'))
  }
  for (const dir of ['~/.claude/rules', '~/.config/opencode/rules']) {
    const target = linkTargets.find(target => target.kind === 'rule' && target.dir === dir)
    assert.ok(target && target.kind === 'rule')
    assert.ok(target.include.includes('communication-rules'))
  }
})

test('communication rule installation preserves user content across relink and unlink', async () => {
  const { root, host } = await fixture()
  const source = localSkillSources.find(source => source.name === 'communication-rules')
  assert.ok(source && source.kind === 'document')
  const rule = await readFile(new URL('../../rules/communication/RULES.md', import.meta.url), 'utf8')
  const sourceFile = join(root, 'communication.md')
  await writeFile(sourceFile, rule)
  const config = { ...source, source: 'communication.md' }
  const file = join(host, 'AGENTS.md')
  const original = '# Personal instructions\nUse Chinese.\n'
  await writeFile(file, original)
  const rulesDir = join(host, 'rules')
  const options = {
    root, localSkillSources: [config], targets: [
      { file, kind: 'markdown-section' as const, section: 'communication-rules', source: 'communication.md' },
      { dir: rulesDir, kind: 'rule' as const, include: ['communication-rules'] },
    ],
  }
  await linkAll(options)
  const installed = await readFile(file, 'utf8')
  assert.ok(installed.startsWith(original))
  assert.ok(installed.includes(rule.trim()))
  assert.equal(await readlink(join(rulesDir, 'communication-rules.md')), join(root, 'generated', 'communication-rules', 'SKILL.md'))
  assert.ok((await linkAll(options)).every(result => result.status === 'exists'))
  assert.equal(await readFile(file, 'utf8'), installed)
  await unlinkAll(options)
  assert.equal(await readFile(file, 'utf8'), original)
  await assert.rejects(readlink(join(rulesDir, 'communication-rules.md')), /ENOENT/)
})

test.after(async () => {
  await Promise.all(temporaryPaths.map(path => rm(path, { recursive: true, force: true })))
})
